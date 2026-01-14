// frame-manager.js
// Handles frame management in the canvas

const FrameManager = {
    /**
     * Render the canvas
     */
    renderCanvas() {
        UI.framesList.innerHTML = '';
        
        State.frames.forEach((frame, i) => {
            const div = document.createElement('div');
            div.className = `frame-thumb ${i === State.currentFrameIndex ? 'active' : ''}`;
            div.onclick = () => this.switchFrame(i);
            
            // Create thumbnail by copying from composition canvas
            const canvas = document.createElement('canvas');
            canvas.width = State.width;
            canvas.height = State.height;
            const ctx = canvas.getContext('2d');

            // Save current frame index
            const currentFrameIndex = State.currentFrameIndex;

            // Temporarily switch to this frame to render it
            State.currentFrameIndex = i;
            CanvasManager.render();

            // Copy the rendered composition to thumbnail
            ctx.drawImage(UI.compositionCanvas, 0, 0);

            // Restore current frame index
            State.currentFrameIndex = currentFrameIndex;
            
            div.appendChild(canvas);
            
            // Frame number label
            const num = document.createElement('span');
            num.className = "frame-number";
            num.innerText = i + 1;
            div.appendChild(num);
            
            UI.framesList.appendChild(div);
        });
    },

    /**
     * Update a specific frame's thumbnail
     */
    updateTimelineThumb(index) {
        if (!UI.framesList.children[index]) return;

        const canvas = UI.framesList.children[index].querySelector('canvas');
        const ctx = canvas.getContext('2d');

        // Save current frame index
        const currentFrameIndex = State.currentFrameIndex;

        // Temporarily switch to this frame to render it
        State.currentFrameIndex = index;
        CanvasManager.render();

        // Copy the rendered composition to thumbnail
        ctx.drawImage(UI.compositionCanvas, 0, 0);

        // Restore current frame index
        State.currentFrameIndex = currentFrameIndex;
    },

    /**
     * Switch to a different frame
     */
    switchFrame(index) {
        if (index < 0 || index >= State.frames.length) return;

        State.currentFrameIndex = index;
        LayerManager.renderList();
        CanvasManager.render();

        // Update active state in timeline
        Array.from(UI.framesList.children).forEach((el, idx) => {
            el.classList.toggle('active', idx === index);
            el.classList.toggle('onion-before',
                State.onionSkinEnabled &&
                idx > State.currentFrameIndex - State.onionSkinFramesBefore &&
                idx < State.currentFrameIndex
            );
            el.classList.toggle('onion-after',
                State.onionSkinEnabled &&
                idx > State.currentFrameIndex &&
                idx <= State.currentFrameIndex + State.onionSkinFramesAfter
            );
        });
    },

    /**
     * Add a new frame
     */
    addFrame() {
        // Create new frame with same layer structure as current frame
        const newLayers = State.frames[0].layers.map(layer => 
            CanvasManager.createLayer(layer.name)
        );
        
        State.frames.splice(State.currentFrameIndex + 1, 0, { layers: newLayers });
        this.switchFrame(State.currentFrameIndex + 1);
        this.renderTimeline();
    },

    /**
     * Duplicate current frame
     */
    duplicateFrame() {
        const src = State.frames[State.currentFrameIndex];
        
        // Deep copy all layers
        const newLayers = src.layers.map(layer => ({
            name: layer.name,
            visible: layer.visible,
            data: new ImageData(new Uint8ClampedArray(layer.data.data), State.width, State.height)
        }));
        
        State.frames.splice(State.currentFrameIndex + 1, 0, { layers: newLayers });
        this.switchFrame(State.currentFrameIndex + 1);
        this.renderTimeline();
    },

    /**
     * Delete a frame
     */
    deleteFrame() {
        if (State.frames.length <= 1) {
            alert('Cannot delete the last frame');
            return;
        }
        
        if (!confirm('Delete this frame?')) return;
        
        State.frames.splice(State.currentFrameIndex, 1);
        
        if (State.currentFrameIndex >= State.frames.length) {
            State.currentFrameIndex = State.frames.length - 1;
        }
        
        this.switchFrame(State.currentFrameIndex);
        this.renderTimeline();
    },




    /**
     * Synchronize UI state with internal frame state
     */
    syncUIState() {
        if (State.isPlaying) {
            UI.playBtn.classList.add('active');
        } else {
            UI.playBtn.classList.remove('active');
        }
    }




};
