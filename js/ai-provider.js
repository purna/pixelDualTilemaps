(() => {
    const PROVIDERS = {
        gemini: { label: 'Google Gemini', model: 'gemini-3.8-flash' },
        openai: { label: 'OpenAI API', model: 'gpt-4.1-mini' },
        claude: { label: 'Anthropic Claude', model: 'claude-sonnet-5' },
        openrouter: { label: 'OpenRouter', model: 'openrouter/auto' }
    };
    const MODEL_FIELD_IDS = {
        gemini: 'pixel-ai-gemini-model',
        openai: 'pixel-ai-openai-model',
        claude: 'pixel-ai-claude-model',
        openrouter: 'pixel-ai-openrouter-model'
    };

    class PixelAIProvider {
        constructor(appId) {
            this.appId = appId || location.pathname.split('/').filter(Boolean)[0] || 'pixel-app';
            this.storageKey = `pixel-ai-settings:${this.appId}`;
            this.settings = this.loadSettings();
            this.lastUsedProvider = null;
            this.lastUsedModel = null;
        }

        loadSettings() {
            const defaults = {
                provider: 'gemini',
                openrouterFallbackEnabled: false,
                gemini: { apiKey: '', model: PROVIDERS.gemini.model },
                openai: { apiKey: '', model: PROVIDERS.openai.model },
                claude: { apiKey: '', model: PROVIDERS.claude.model },
                openrouter: { apiKey: '', model: PROVIDERS.openrouter.model }
            };
            try {
                const saved = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
                const settings = { ...defaults, ...saved };
                for (const provider of Object.keys(PROVIDERS)) {
                    settings[provider] = { ...defaults[provider], ...(saved[provider] || {}) };
                }
                if (!PROVIDERS[settings.provider]) settings.provider = 'gemini';
                settings.openrouterFallbackEnabled = saved.openrouterFallbackEnabled === true;
                return settings;
            } catch {
                return defaults;
            }
        }

        saveSettings(settings) {
            const next = { ...this.settings, provider: settings.provider, openrouterFallbackEnabled: settings.openrouterFallbackEnabled === true };
            for (const provider of Object.keys(PROVIDERS)) {
                next[provider] = { ...this.settings[provider] };
                if (settings[provider]) {
                    next[provider].apiKey = String(settings[provider].apiKey || '').trim();
                    next[provider].model = String(settings[provider].model || '').trim() || PROVIDERS[provider].model;
                }
            }
            if (!PROVIDERS[next.provider]) next.provider = 'gemini';
            this.settings = next;
            localStorage.setItem(this.storageKey, JSON.stringify(next));
        }

        async generateText(userText, systemText, generationConfig = null) {
            const provider = this.settings.provider;
            const config = this.settings[provider];
            if (!config.apiKey.trim()) throw new Error(`Add your ${PROVIDERS[provider].label} API key in Settings → AI.`);
            if (!config.model.trim()) throw new Error('Enter a model name in Settings → AI.');

            try {
                const text = await this.requestWithProvider(provider, userText, systemText, generationConfig);
                this.lastUsedProvider = provider;
                this.lastUsedModel = config.model;
                return text;
            } catch (primaryError) {
                if (provider !== 'openrouter' || !this.settings.openrouterFallbackEnabled || !this.isRetryable(primaryError)) throw primaryError;
                const freeModels = await this.getOpenRouterFreeModels();
                const currentIndex = freeModels.findIndex(model => model.id === config.model);
                const candidates = currentIndex < 0
                    ? freeModels
                    : [...freeModels.slice(currentIndex + 1), ...freeModels.slice(0, currentIndex)];
                const errors = [primaryError];
                for (const model of candidates) {
                    try {
                        const text = await this.requestWithProvider('openrouter', userText, systemText, generationConfig, model.id);
                        this.lastUsedProvider = provider;
                        this.lastUsedModel = model.id;
                        return text;
                    } catch (error) {
                        errors.push(error);
                        if (!this.isRetryable(error)) throw error;
                    }
                }
                throw new Error(`OpenRouter and its remaining free models are unavailable. ${errors.map(error => error.message).join(' | ')}`);
            }
        }

        isRetryable(error) {
            return error instanceof TypeError || [402, 408, 425, 429].includes(error.status) || error.status >= 500;
        }

        async requestWithProvider(provider, userText, systemText, generationConfig = null, modelOverride = '') {
            const config = this.settings[provider];
            const model = modelOverride || config.model.trim();
            let response;
            if (provider === 'gemini') {
                const payload = {
                    systemInstruction: { parts: [{ text: systemText || '' }] },
                    contents: [{ parts: [{ text: userText }] }]
                };
                if (generationConfig) payload.generationConfig = generationConfig;
                response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(config.apiKey.trim())}`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
                });
            } else {
                const apiKey = config.apiKey.trim().replace(/^Bearer\s+/i, '');
                const isClaude = provider === 'claude';
                const endpoint = provider === 'openai'
                    ? 'https://api.openai.com/v1/chat/completions'
                    : isClaude ? 'https://api.anthropic.com/v1/messages' : 'https://openrouter.ai/api/v1/chat/completions';
                const headers = { 'Content-Type': 'application/json' };
                const body = { model, messages: [{ role: 'system', content: systemText || '' }, { role: 'user', content: userText }], temperature: 0.2, max_tokens: 2048 };
                if (isClaude) {
                    headers['x-api-key'] = apiKey;
                    headers['anthropic-version'] = '2023-06-01';
                    headers['anthropic-dangerous-direct-browser-access'] = 'true';
                    body.system = systemText || '';
                    delete body.messages[0];
                    body.messages = [{ role: 'user', content: userText }];
                } else {
                    headers.Authorization = `Bearer ${apiKey}`;
                }
                response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
            }

            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                const error = new Error(`${PROVIDERS[provider].label} request failed: ${result.error?.message || result.message || `HTTP ${response.status}`}`);
                error.status = response.status;
                throw error;
            }
            const text = provider === 'gemini'
                ? result.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('')
                : provider === 'claude'
                    ? result.content?.filter(part => part.type === 'text').map(part => part.text).join('')
                    : result.choices?.[0]?.message?.content;
            if (typeof text !== 'string' || !text.trim()) throw new Error(`${PROVIDERS[provider].label} returned an empty response.`);
            return text;
        }

        async getOpenRouterFreeModels() {
            const response = await fetch('https://openrouter.ai/api/v1/models');
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(`Could not load OpenRouter models (HTTP ${response.status}).`);
            return (Array.isArray(data.data) ? data.data : [])
                .filter(model => typeof model.id === 'string' && Number(model.pricing?.prompt) === 0 && Number(model.pricing?.completion) === 0)
                .sort((a, b) => a.id.localeCompare(b.id));
        }

        async testConnection() {
            return this.generateText('Reply with READY only.', 'You are checking that the API connection works. Reply with READY only.');
        }
    }

    window.PixelAIProvider = new PixelAIProvider(document.currentScript?.dataset.appId);
    window.PixelAIProviderClass = PixelAIProvider;

    function addStyles() {
        if (document.getElementById('pixel-ai-settings-styles')) return;
        const style = document.createElement('style');
        style.id = 'pixel-ai-settings-styles';
        style.textContent = `
            .pixel-ai-provider-fields[hidden], #pixel-ai-openrouter-model-list[hidden] { display:none !important; }
            .pixel-ai-form { padding:12px; max-height:65vh; overflow:auto; }
            .pixel-ai-form label { display:block; margin:10px 0 5px; }
            .pixel-ai-form input, .pixel-ai-form select { box-sizing:border-box; width:100%; padding:8px; }
            .pixel-ai-help, .pixel-ai-status { font-size:.78rem; line-height:1.45; opacity:.85; }
            .pixel-ai-form button { margin-top:10px; }
        `;
        document.head.appendChild(style);
    }

    function activatePanel(modal, tab, panel, tabs, panels) {
        tabs.forEach(item => item.classList.toggle('active', item === tab));
        panels.forEach(item => item.classList.toggle('active', item === panel));
        tab.setAttribute('aria-selected', 'true');
        tabs.filter(item => item !== tab).forEach(item => item.setAttribute('aria-selected', 'false'));
    }

    function makeSettingsPanel(modal, index) {
        const tabsHost = modal.querySelector('.settings-tabs');
        if (!tabsHost) return;
        const poseMode = !!modal.querySelector('.settings-panels') && !modal.querySelector('.settings-tab-content');
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.className = 'settings-tab';
        tab.dataset.pixelAiTab = 'true';
        tab.dataset.tab = 'pixel-ai';
        if (poseMode) tab.dataset.panel = 'ai';
        else tab.dataset.tabContent = 'pixel-ai';
        tab.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> AI';
        tabsHost.appendChild(tab);

        const panelsHost = modal.querySelector('.settings-panels') || modal.querySelector('.modal-content-wrapper, .modal-content, .settings-panel-wrapper') || modal.querySelector('.modal');
        if (!panelsHost) return;
        const panel = document.createElement('div');
        panel.className = poseMode ? 'settings-panel' : 'settings-tab-content';
        panel.dataset.pixelAiPanel = 'true';
        panel.dataset.panel = 'ai';
        panel.dataset.tabContent = 'pixel-ai';
        panel.innerHTML = `
            <div class="pixel-ai-form">
                <h3>AI Provider</h3>
                <p class="pixel-ai-help">Use an API key from the provider's developer platform. OpenAI API access is separate from a ChatGPT subscription. Keys are stored unencrypted in this browser profile.</p>
                <label for="pixel-ai-provider-${index}">Provider</label>
                <select id="pixel-ai-provider-${index}">
                    <option value="gemini">Google Gemini</option><option value="openai">OpenAI API</option>
                    <option value="claude">Anthropic Claude</option><option value="openrouter">OpenRouter</option>
                </select>
                <div class="pixel-ai-provider-fields" data-provider="gemini">
                    <label for="pixel-ai-gemini-key-${index}">Gemini API key</label><input id="pixel-ai-gemini-key-${index}" type="password" autocomplete="off">
                    <label for="pixel-ai-gemini-model-${index}">Gemini model</label><input id="pixel-ai-gemini-model-${index}" value="gemini-3.8-flash">
                </div>
                <div class="pixel-ai-provider-fields" data-provider="openai" hidden>
                    <label for="pixel-ai-openai-key-${index}">OpenAI API key</label><input id="pixel-ai-openai-key-${index}" type="password" autocomplete="off">
                    <label for="pixel-ai-openai-model-${index}">OpenAI model</label><input id="pixel-ai-openai-model-${index}" value="gpt-4.1-mini">
                </div>
                <div class="pixel-ai-provider-fields" data-provider="claude" hidden>
                    <label for="pixel-ai-claude-key-${index}">Claude API key</label><input id="pixel-ai-claude-key-${index}" type="password" autocomplete="off">
                    <label for="pixel-ai-claude-model-${index}">Claude model</label><input id="pixel-ai-claude-model-${index}" value="claude-sonnet-5">
                </div>
                <div class="pixel-ai-provider-fields" data-provider="openrouter" hidden>
                    <label for="pixel-ai-openrouter-key-${index}">OpenRouter API key</label><input id="pixel-ai-openrouter-key-${index}" type="password" autocomplete="off">
                    <label for="pixel-ai-openrouter-model-${index}">OpenRouter model</label><input id="pixel-ai-openrouter-model-${index}" value="openrouter/auto">
                    <button type="button" class="pixel-ai-load-models">Load free models</button>
                    <select id="pixel-ai-openrouter-model-list" hidden><option value="">Choose a free model…</option></select>
                    <label><input type="checkbox" class="pixel-ai-fallback"> Try the next free model when this OpenRouter model is limited</label>
                </div>
                <p class="pixel-ai-status" role="status"></p>
                <button type="button" class="pixel-ai-test">Test selected provider</button>
                <button type="button" class="pixel-ai-save">Save AI settings</button>
            </div>
        `;
        panelsHost.appendChild(panel);

        const tabs = [...tabsHost.querySelectorAll('.settings-tab')];
        const panels = poseMode
            ? [...modal.querySelectorAll('.settings-panel')]
            : [...modal.querySelectorAll('.settings-tab-content')];
        tab.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            activatePanel(modal, tab, panel, tabs, panels);
        });
        tabsHost.addEventListener('click', event => {
            if (event.target.closest('.settings-tab') !== tab) panel.classList.remove('active');
        });

        const providerSelect = panel.querySelector('select[id^="pixel-ai-provider-"]');
        const status = panel.querySelector('.pixel-ai-status');
        const showFields = () => panel.querySelectorAll('.pixel-ai-provider-fields').forEach(fields => {
            fields.hidden = fields.dataset.provider !== providerSelect.value;
        });
        const load = () => {
            const settings = window.PixelAIProvider.settings;
            providerSelect.value = settings.provider;
            for (const provider of Object.keys(PROVIDERS)) {
                const suffix = provider[0].toUpperCase() + provider.slice(1);
                panel.querySelector(`#pixel-ai-${provider}-key-${index}`).value = settings[provider].apiKey;
                panel.querySelector(`#pixel-ai-${provider}-model-${index}`).value = settings[provider].model;
            }
            panel.querySelector('.pixel-ai-fallback').checked = settings.openrouterFallbackEnabled;
            showFields();
        };
        const save = () => {
            const settings = {
                provider: providerSelect.value,
                openrouterFallbackEnabled: panel.querySelector('.pixel-ai-fallback').checked
            };
            for (const provider of Object.keys(PROVIDERS)) {
                settings[provider] = {
                    apiKey: panel.querySelector(`#pixel-ai-${provider}-key-${index}`).value,
                    model: panel.querySelector(`#pixel-ai-${provider}-model-${index}`).value
                };
            }
            window.PixelAIProvider.saveSettings(settings);
            status.textContent = 'AI settings saved in this browser.';
        };
        providerSelect.addEventListener('change', showFields);
        panel.querySelector('.pixel-ai-save').addEventListener('click', save);
        panel.querySelector('.pixel-ai-test').addEventListener('click', async () => {
            save();
            status.textContent = 'Testing provider…';
            try {
                const answer = await window.PixelAIProvider.testConnection();
                status.textContent = `Connection works (${window.PixelAIProvider.lastUsedModel}): ${answer.trim().slice(0, 100)}`;
            } catch (error) {
                status.textContent = error.message;
            }
        });
        panel.querySelector('.pixel-ai-load-models').addEventListener('click', async event => {
            const button = event.currentTarget;
            const select = panel.querySelector('#pixel-ai-openrouter-model-list');
            button.disabled = true;
            status.textContent = 'Loading public OpenRouter model list…';
            try {
                const models = await window.PixelAIProvider.getOpenRouterFreeModels();
                select.replaceChildren(new Option('Choose a free model…', ''));
                models.forEach(model => select.add(new Option(model.name ? `${model.id} — ${model.name}` : model.id, model.id)));
                select.hidden = models.length === 0;
                status.textContent = models.length ? `${models.length} free models found.` : 'No free models found.';
            } catch (error) {
                status.textContent = error.message;
                select.hidden = true;
            } finally {
                button.disabled = false;
            }
        });
        panel.querySelector('#pixel-ai-openrouter-model-list').addEventListener('change', event => {
            if (event.target.value) panel.querySelector('[data-provider="openrouter"] input[id^="pixel-ai-openrouter-model-"]').value = event.target.value;
        });
        load();
    }

    function initSettingsUI() {
        if (!document.body) return;
        addStyles();
        const modals = document.querySelectorAll('#unified-settings-modal, #settings-modal, #settingsModal');
        modals.forEach((modal, index) => {
            if (!modal.querySelector('.settings-tabs') || modal.querySelector('[data-pixel-ai-tab]')) return;
            makeSettingsPanel(modal, index);
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initSettingsUI, { once: true });
    else initSettingsUI();
})();
