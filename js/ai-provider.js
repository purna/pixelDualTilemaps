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
            .pixel-ai-form { display:flex; flex-direction:column; gap:14px; color:var(--text-primary); }
            .pixel-ai-form .settings-section {
                margin:0; padding:12px; background:var(--bg-light);
                border:1px solid var(--border-color); border-radius:6px;
            }
            .pixel-ai-form .section-heading {
                display:flex; align-items:center; gap:8px; margin-bottom:10px;
            }
            .pixel-ai-form .property-group {
                margin:0; padding:0; border:0; background:transparent;
            }
            .pixel-ai-form .property-group + .property-group { margin-top:12px; }
            .pixel-ai-form .property-label {
                display:block; margin-bottom:6px; font-size:.75rem;
                font-weight:500; color:var(--text-primary);
            }
            .pixel-ai-form .settings-input,
            .pixel-ai-form .settings-select {
                box-sizing:border-box; width:100%; padding:8px 10px;
                background:var(--bg-medium); border:1px solid var(--border-color);
                border-radius:4px; color:var(--text-primary);
                font:inherit; font-size:.8rem;
            }
            .pixel-ai-form .settings-input::placeholder { color:var(--text-secondary); }
            .pixel-ai-form .settings-input:focus,
            .pixel-ai-form .settings-select:focus {
                outline:none; border-color:var(--accent-primary);
                box-shadow:0 0 8px var(--border-glow);
            }
            .pixel-ai-form .pixel-ai-help {
                margin:0 0 12px; color:var(--text-secondary);
                font-size:.75rem; line-height:1.45;
            }
            .pixel-ai-form .pixel-ai-status {
                min-height:1.25em; margin:0 0 12px; color:var(--accent-tertiary);
                font-size:.75rem; line-height:1.45;
            }
            .pixel-ai-form .pixel-ai-actions { display:flex; flex-wrap:wrap; gap:8px; }
            .pixel-ai-form .pixel-ai-actions .btn { flex:1 1 150px; justify-content:center; }
            .pixel-ai-form .pixel-ai-load-models { width:100%; justify-content:center; margin-top:8px; }
            .pixel-ai-form .pixel-ai-checkbox-label {
                display:flex; align-items:flex-start; gap:8px; margin-top:12px;
                font-size:.75rem; line-height:1.4; color:var(--text-primary);
                cursor:pointer;
            }
            .pixel-ai-form .pixel-ai-checkbox-label input[type="checkbox"] {
                flex-shrink:0; width:16px; height:16px; margin:1px 0 0;
                accent-color:var(--accent-primary); cursor:pointer;
            }
            .pixel-ai-form .btn:disabled {
                opacity:.55; cursor:not-allowed; transform:none; box-shadow:none;
            }
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
                <div class="settings-section">
                    <div class="section-heading"><i class="fas fa-key"></i> AI Provider</div>
                    <p class="pixel-ai-help">Use an API key from the provider's developer platform. OpenAI API access is separate from a ChatGPT subscription. Keys are stored unencrypted in this browser profile.</p>
                    <div class="property-group">
                        <label class="property-label" for="pixel-ai-provider-${index}">Provider</label>
                        <select class="settings-select" id="pixel-ai-provider-${index}">
                            <option value="gemini">Google Gemini</option><option value="openai">OpenAI API</option>
                            <option value="claude">Anthropic Claude</option><option value="openrouter">OpenRouter</option>
                        </select>
                    </div>
                </div>
                <div class="settings-section pixel-ai-provider-fields" data-provider="gemini">
                    <div class="section-heading">Google Gemini</div>
                    <div class="property-group">
                        <label class="property-label" for="pixel-ai-gemini-key-${index}">API key</label>
                        <input class="settings-input" id="pixel-ai-gemini-key-${index}" type="password" autocomplete="off" placeholder="Paste your Gemini API key">
                    </div>
                    <div class="property-group">
                        <label class="property-label" for="pixel-ai-gemini-model-${index}">Model</label>
                        <input class="settings-input" id="pixel-ai-gemini-model-${index}" value="gemini-3.8-flash">
                    </div>
                </div>
                <div class="settings-section pixel-ai-provider-fields" data-provider="openai" hidden>
                    <div class="section-heading">OpenAI API</div>
                    <div class="property-group">
                        <label class="property-label" for="pixel-ai-openai-key-${index}">API key</label>
                        <input class="settings-input" id="pixel-ai-openai-key-${index}" type="password" autocomplete="off" placeholder="Paste your OpenAI API key">
                    </div>
                    <div class="property-group">
                        <label class="property-label" for="pixel-ai-openai-model-${index}">Model</label>
                        <input class="settings-input" id="pixel-ai-openai-model-${index}" value="gpt-4.1-mini">
                    </div>
                </div>
                <div class="settings-section pixel-ai-provider-fields" data-provider="claude" hidden>
                    <div class="section-heading">Anthropic Claude</div>
                    <div class="property-group">
                        <label class="property-label" for="pixel-ai-claude-key-${index}">API key</label>
                        <input class="settings-input" id="pixel-ai-claude-key-${index}" type="password" autocomplete="off" placeholder="Paste your Claude API key">
                    </div>
                    <div class="property-group">
                        <label class="property-label" for="pixel-ai-claude-model-${index}">Model</label>
                        <input class="settings-input" id="pixel-ai-claude-model-${index}" value="claude-sonnet-5">
                    </div>
                </div>
                <div class="settings-section pixel-ai-provider-fields" data-provider="openrouter" hidden>
                    <div class="section-heading">OpenRouter</div>
                    <div class="property-group">
                        <label class="property-label" for="pixel-ai-openrouter-key-${index}">API key</label>
                        <input class="settings-input" id="pixel-ai-openrouter-key-${index}" type="password" autocomplete="off" placeholder="Paste your OpenRouter API key">
                    </div>
                    <div class="property-group">
                        <label class="property-label" for="pixel-ai-openrouter-model-${index}">Model</label>
                        <input class="settings-input" id="pixel-ai-openrouter-model-${index}" value="openrouter/auto">
                        <button type="button" class="btn pixel-ai-load-models"><i class="fas fa-sync-alt"></i> Load free models</button>
                        <select class="settings-select" id="pixel-ai-openrouter-model-list" hidden><option value="">Choose a free model…</option></select>
                    </div>
                    <label class="pixel-ai-checkbox-label"><input type="checkbox" class="pixel-ai-fallback"> Try the next free model when this OpenRouter model is limited</label>
                </div>
                <div class="settings-section">
                    <div class="section-heading">Connection</div>
                    <p class="pixel-ai-status" role="status"></p>
                    <div class="pixel-ai-actions">
                        <button type="button" class="btn pixel-ai-test"><i class="fas fa-bolt"></i> Test provider</button>
                        <button type="button" class="btn primary pixel-ai-save"><i class="fas fa-save"></i> Save AI settings</button>
                    </div>
                </div>
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
