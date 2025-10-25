// 3x3 Cube Puzzle Game - Complete Rotation Logic Implementation
class CubePuzzleGame {
    constructor() {
        this.container = null;
        this.cube = this.createSolvedCube();
        this.cubeElement = null;
        this.cubies = []; // Individual 3x3x3 = 27 small cubes
        this.rotation = { x: -30, y: -45 };
        this.moveCount = 0;
        this.isAnimating = false;
        this.cubieSize = 95;
        this.gap = 5;
        
        // Touch control state
        this.touchStartPos = null;
        this.touchStartCubie = null;
        this.isDraggingView = false;
        this.previousMousePosition = { x: 0, y: 0 };
        
        this.colors = {
            0: '#FF0000', // Red - Front (z=2)
            1: '#FF8800', // Orange - Back (z=0)
            2: '#00FF00', // Green - Left (x=0)
            3: '#0000FF', // Blue - Right (x=2)
            4: '#FFFF00', // Yellow - Top (y=0)
            5: '#FFFFFF'  // White - Bottom (y=2)
        };
        
        this.init();
    }

    init() {
        this.setupScene();
        this.setupCube();
        this.setupControls();
        this.scrambleCube();
        this.updateCubeRotation();
    }

    setupScene() {
        this.container = document.getElementById('canvas-container');
        this.container.style.perspective = '1000px';
        this.container.style.perspectiveOrigin = '50% 50%';
        
        this.cubeElement = document.createElement('div');
        this.cubeElement.className = 'cube-3d';
        this.cubeElement.style.cssText = `
            position: relative;
            width: 300px;
            height: 300px;
            transform-style: preserve-3d;
            margin: 0 auto;
        `;
        
        this.container.appendChild(this.cubeElement);
    }

    setupCube() {
        this.cubies = [];
        
        // Create 27 small cubes (3x3x3)
        for (let x = 0; x < 3; x++) {
            for (let y = 0; y < 3; y++) {
                for (let z = 0; z < 3; z++) {
                    const cubie = this.createCubie(x, y, z);
                    this.cubies.push(cubie);
                    this.cubeElement.appendChild(cubie.element);
                }
            }
        }
        
        this.updateCubieColors();
    }

    createCubie(x, y, z) {
        const cubie = document.createElement('div');
        cubie.className = 'cubie';
        
        const offset = (this.cubieSize + this.gap) - (this.cubieSize + this.gap) * 1.5;
        const posX = x * (this.cubieSize + this.gap) + offset;
        const posY = -y * (this.cubieSize + this.gap) - offset;
        const posZ = z * (this.cubieSize + this.gap) + offset;
        
        cubie.style.cssText = `
            position: absolute;
            width: ${this.cubieSize}px;
            height: ${this.cubieSize}px;
            transform-style: preserve-3d;
            transform: translate3d(${posX}px, ${posY}px, ${posZ}px);
            transition: transform 0.3s ease-out;
        `;
        
        // Create 6 faces for each cubie
        const faces = [
            { name: 'front', rotation: 'rotateY(0deg)', translate: `0, 0, ${this.cubieSize/2}px` },
            { name: 'back', rotation: 'rotateY(180deg)', translate: `0, 0, ${this.cubieSize/2}px` },
            { name: 'right', rotation: 'rotateY(90deg)', translate: `0, 0, ${this.cubieSize/2}px` },
            { name: 'left', rotation: 'rotateY(-90deg)', translate: `0, 0, ${this.cubieSize/2}px` },
            { name: 'top', rotation: 'rotateX(90deg)', translate: `0, 0, ${this.cubieSize/2}px` },
            { name: 'bottom', rotation: 'rotateX(-90deg)', translate: `0, 0, ${this.cubieSize/2}px` }
        ];
        
        const faceElements = {};
        faces.forEach(face => {
            const faceEl = document.createElement('div');
            faceEl.className = `face face-${face.name}`;
            faceEl.style.cssText = `
                position: absolute;
                width: ${this.cubieSize}px;
                height: ${this.cubieSize}px;
                background: #000;
                border: 2px solid #222;
                transform: ${face.rotation} translate3d(${face.translate});
                backface-visibility: hidden;
            `;
            cubie.appendChild(faceEl);
            faceElements[face.name] = faceEl;
        });
        
        return {
            element: cubie,
            faces: faceElements,
            position: { x, y, z },
            rotation: { x: 0, y: 0, z: 0 }
        };
    }

    updateCubieColors() {
        const faceMapping = {
            front: { axis: 'z', value: 2 },
            back: { axis: 'z', value: 0 },
            left: { axis: 'x', value: 0 },
            right: { axis: 'x', value: 2 },
            top: { axis: 'y', value: 0 },
            bottom: { axis: 'y', value: 2 }
        };
        
        Object.keys(faceMapping).forEach(faceName => {
            const face = this.cube[faceName];
            const mapping = faceMapping[faceName];
            
            // Get cubies on this face
            const faceCubies = this.cubies.filter(cubie => 
                cubie.position[mapping.axis] === mapping.value
            );
            
            // Sort cubies to match the face array order
            faceCubies.sort((a, b) => {
                if (mapping.axis === 'z') {
                    if (a.position.y !== b.position.y) return a.position.y - b.position.y;
                    return a.position.x - b.position.x;
                } else if (mapping.axis === 'y') {
                    if (a.position.z !== b.position.z) return a.position.z - b.position.z;
                    return a.position.x - b.position.x;
                } else { // x axis
                    if (a.position.y !== b.position.y) return a.position.y - b.position.y;
                    if (mapping.value === 2) return a.position.z - b.position.z;
                    return b.position.z - a.position.z;
                }
            });
            
            // Update colors
            faceCubies.forEach((cubie, index) => {
                const colorIndex = face[index];
                const faceEl = cubie.faces[faceName];
                if (faceEl) {
                    faceEl.style.background = this.colors[colorIndex];
                }
            });
        });
    }

    updateCubeRotation() {
        this.cubeElement.style.transform = `rotateX(${this.rotation.x}deg) rotateY(${this.rotation.y}deg)`;
    }

    getCubieAtPoint(clientX, clientY) {
        // Use document.elementFromPoint to find which cubie was clicked
        const element = document.elementFromPoint(clientX, clientY);
        if (!element) return null;
        
        // Find the cubie element (either the element itself or a parent)
        let cubieElement = element;
        while (cubieElement && !cubieElement.classList.contains('cubie')) {
            cubieElement = cubieElement.parentElement;
            if (cubieElement === this.cubeElement || !cubieElement) break;
        }
        
        if (!cubieElement || !cubieElement.classList.contains('cubie')) return null;
        
        // Find the cubie object
        return this.cubies.find(c => c.element === cubieElement);
    }

    determineLayerMove(cubie, deltaX, deltaY) {
        // Determine which layer to rotate based on cubie position and drag direction
        const { x, y, z } = cubie.position;
        
        // Determine primary drag direction
        const isDragHorizontal = Math.abs(deltaX) > Math.abs(deltaY);
        
        // Based on cube orientation and drag direction, determine the move
        // Simplified: we'll map common drag patterns to moves
        // This is a basic implementation - could be enhanced with view rotation awareness
        
        if (isDragHorizontal) {
            // Horizontal drag
            if (deltaX > 0) {
                // Drag right
                if (y === 0) return 'U';
                if (y === 2) return 'Di';
                if (z === 2) return 'F';
                if (z === 0) return 'Bi';
            } else {
                // Drag left
                if (y === 0) return 'Ui';
                if (y === 2) return 'D';
                if (z === 2) return 'Fi';
                if (z === 0) return 'B';
            }
        } else {
            // Vertical drag
            if (deltaY > 0) {
                // Drag down
                if (x === 0) return 'L';
                if (x === 2) return 'Ri';
                if (z === 2) return 'Fi';
                if (z === 0) return 'B';
            } else {
                // Drag up
                if (x === 0) return 'Li';
                if (x === 2) return 'R';
                if (z === 2) return 'F';
                if (z === 0) return 'Bi';
            }
        }
        
        return null;
    }

    setupControls() {
        let touchCount = 0;
        let draggedLayer = null;
        
        const onPointerDown = (e) => {
            if (this.isAnimating) return;
            
            if (e.touches) {
                touchCount = e.touches.length;
                if (touchCount === 2) {
                    // Two finger touch - rotate view
                    this.isDraggingView = true;
                    const touch = e.touches[0];
                    this.previousMousePosition = { x: touch.clientX, y: touch.clientY };
                    e.preventDefault();
                    return;
                }
            }
            
            // Single touch or mouse - could be layer rotation or view rotation
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            
            // Check if clicking on a cubie for layer rotation
            const clickedCubie = this.getCubieAtPoint(clientX, clientY);
            if (clickedCubie && e.touches) {
                // Mobile: touching a cubie means layer rotation
                this.touchStartPos = { x: clientX, y: clientY };
                this.touchStartCubie = clickedCubie;
                draggedLayer = null;
            } else {
                // Desktop or no cubie: view rotation
                this.touchStartPos = { x: clientX, y: clientY };
                this.touchStartCubie = null;
                this.previousMousePosition = { x: clientX, y: clientY };
            }
        };

        const onPointerMove = (e) => {
            if (this.isAnimating) return;
            
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            
            if (e.touches && e.touches.length === 2) {
                // Two finger rotation
                if (this.isDraggingView) {
                    e.preventDefault();
                    const deltaX = clientX - this.previousMousePosition.x;
                    const deltaY = clientY - this.previousMousePosition.y;
                    
                    this.rotation.y += deltaX * 0.5;
                    this.rotation.x += deltaY * 0.5;
                    
                    this.updateCubeRotation();
                    this.previousMousePosition = { x: clientX, y: clientY };
                }
                return;
            }
            
            if (!this.touchStartPos) return;
            
            const deltaX = clientX - this.touchStartPos.x;
            const deltaY = clientY - this.touchStartPos.y;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            
            // Check if we should do layer rotation (mobile with cubie) or view rotation
            if (this.touchStartCubie && e.touches && distance > 30 && !draggedLayer) {
                // Determine which layer to rotate based on drag direction
                e.preventDefault();
                const move = this.determineLayerMove(this.touchStartCubie, deltaX, deltaY);
                if (move) {
                    draggedLayer = move;
                    this.executeMove(move, true);
                }
            } else if (!e.touches && distance > 5 && !this.touchStartCubie) {
                // Desktop: view rotation
                e.preventDefault();
                this.rotation.y += (clientX - this.previousMousePosition.x) * 0.5;
                this.rotation.x += (clientY - this.previousMousePosition.y) * 0.5;
                this.updateCubeRotation();
                this.previousMousePosition = { x: clientX, y: clientY };
            }
        };

        const onPointerUp = () => {
            this.isDraggingView = false;
            this.touchStartPos = null;
            this.touchStartCubie = null;
            draggedLayer = null;
            touchCount = 0;
        };

        this.container.addEventListener('mousedown', onPointerDown);
        this.container.addEventListener('mousemove', onPointerMove);
        this.container.addEventListener('mouseup', onPointerUp);
        this.container.addEventListener('mouseleave', onPointerUp);

        this.container.addEventListener('touchstart', onPointerDown, { passive: false });
        this.container.addEventListener('touchmove', onPointerMove, { passive: false });
        this.container.addEventListener('touchend', onPointerUp);
        this.container.addEventListener('touchcancel', onPointerUp);

        document.getElementById('reset-btn').addEventListener('click', () => this.resetCube());
        document.getElementById('hint-btn').addEventListener('click', () => this.showHint());
        
        // Add rotation buttons
        this.addRotationButtons();
        
        window.addEventListener('resize', () => this.onWindowResize(), false);
    }

    addRotationButtons() {
        const controls = document.getElementById('controls');
        const rotationControls = document.createElement('div');
        rotationControls.id = 'rotation-controls';
        rotationControls.style.cssText = 'display: flex; gap: 5px; margin-top: 10px; flex-wrap: wrap; justify-content: center;';
        
        const moves = [
            { label: 'U', move: 'U' }, { label: 'U\'', move: 'Ui' },
            { label: 'D', move: 'D' }, { label: 'D\'', move: 'Di' },
            { label: 'L', move: 'L' }, { label: 'L\'', move: 'Li' },
            { label: 'R', move: 'R' }, { label: 'R\'', move: 'Ri' },
            { label: 'F', move: 'F' }, { label: 'F\'', move: 'Fi' },
            { label: 'B', move: 'B' }, { label: 'B\'', move: 'Bi' }
        ];
        
        moves.forEach(({ label, move }) => {
            const btn = document.createElement('button');
            btn.textContent = label;
            btn.className = 'btn-small';
            btn.addEventListener('click', () => this.executeMove(move, true));
            rotationControls.appendChild(btn);
        });
        
        controls.appendChild(rotationControls);
    }

    createSolvedCube() {
        return {
            front: Array(9).fill(0),  // Red
            back: Array(9).fill(1),   // Orange
            left: Array(9).fill(2),   // Green
            right: Array(9).fill(3),  // Blue
            top: Array(9).fill(4),    // Yellow
            bottom: Array(9).fill(5)  // White
        };
    }

    scrambleCube() {
        const moves = ['U', 'D', 'L', 'R', 'F', 'B'];
        const scrambleMoves = 20;
        
        for (let i = 0; i < scrambleMoves; i++) {
            const move = moves[Math.floor(Math.random() * moves.length)];
            this.executeMove(move, false);
        }
    }

    async executeMove(move, countMove = false) {
        if (this.isAnimating) return;
        
        if (countMove) {
            this.moveCount++;
            document.getElementById('moves').textContent = this.moveCount;
        }
        
        this.isAnimating = true;
        
        switch(move) {
            case 'U': await this.rotateTop(true); break;
            case 'Ui': await this.rotateTop(false); break;
            case 'D': await this.rotateBottom(true); break;
            case 'Di': await this.rotateBottom(false); break;
            case 'L': await this.rotateLeft(true); break;
            case 'Li': await this.rotateLeft(false); break;
            case 'R': await this.rotateRight(true); break;
            case 'Ri': await this.rotateRight(false); break;
            case 'F': await this.rotateFront(true); break;
            case 'Fi': await this.rotateFront(false); break;
            case 'B': await this.rotateBack(true); break;
            case 'Bi': await this.rotateBack(false); break;
        }
        
        this.isAnimating = false;
        
        if (countMove) {
            this.checkWinCondition();
        }
    }

    rotateFace(face, clockwise = true) {
        const temp = [...face];
        if (clockwise) {
            face[0] = temp[6]; face[1] = temp[3]; face[2] = temp[0];
            face[3] = temp[7]; face[4] = temp[4]; face[5] = temp[1];
            face[6] = temp[8]; face[7] = temp[5]; face[8] = temp[2];
        } else {
            face[0] = temp[2]; face[1] = temp[5]; face[2] = temp[8];
            face[3] = temp[1]; face[4] = temp[4]; face[5] = temp[7];
            face[6] = temp[0]; face[7] = temp[3]; face[8] = temp[6];
        }
    }

    async rotateLayerAnimation(cubies, axis, angle) {
        // Apply rotation to each cubie in the layer
        cubies.forEach(cubie => {
            const currentTransform = cubie.element.style.transform;
            const rotation = axis === 'x' ? `rotateX(${angle}deg)` :
                           axis === 'y' ? `rotateY(${angle}deg)` :
                           `rotateZ(${angle}deg)`;
            cubie.element.style.transform = `${rotation} ${currentTransform}`;
        });
        
        // Wait for animation to complete
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Update positions and reset transform
        this.updateCubiePositions(cubies, axis, angle);
    }

    updateCubiePositions(cubies, axis, angle) {
        const radians = (angle * Math.PI) / 180;
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        
        cubies.forEach(cubie => {
            let { x, y, z } = cubie.position;
            let newX = x, newY = y, newZ = z;
            
            // Apply rotation matrix
            if (axis === 'y') {
                // Rotation around Y axis
                newX = Math.round(x * cos + z * sin);
                newZ = Math.round(-x * sin + z * cos);
            } else if (axis === 'x') {
                // Rotation around X axis  
                newY = Math.round(y * cos - z * sin);
                newZ = Math.round(y * sin + z * cos);
            } else if (axis === 'z') {
                // Rotation around Z axis
                newX = Math.round(x * cos - y * sin);
                newY = Math.round(x * sin + y * cos);
            }
            
            cubie.position = { x: newX, y: newY, z: newZ };
            
            // Update visual position
            const offset = (this.cubieSize + this.gap) - (this.cubieSize + this.gap) * 1.5;
            const posX = newX * (this.cubieSize + this.gap) + offset;
            const posY = -newY * (this.cubieSize + this.gap) - offset;
            const posZ = newZ * (this.cubieSize + this.gap) + offset;
            
            cubie.element.style.transform = `translate3d(${posX}px, ${posY}px, ${posZ}px)`;
        });
    }

    async rotateTop(clockwise = true) {
        this.rotateFace(this.cube.top, clockwise);
        
        // Get cubies on top layer (y = 0)
        const layerCubies = this.cubies.filter(c => c.position.y === 0);
        
        // Animate rotation
        await this.rotateLayerAnimation(layerCubies, 'y', clockwise ? -90 : 90);
        
        // Update color state
        const temp = [this.cube.front[0], this.cube.front[1], this.cube.front[2]];
        if (clockwise) {
            this.cube.front[0] = this.cube.right[0];
            this.cube.front[1] = this.cube.right[1];
            this.cube.front[2] = this.cube.right[2];
            
            this.cube.right[0] = this.cube.back[0];
            this.cube.right[1] = this.cube.back[1];
            this.cube.right[2] = this.cube.back[2];
            
            this.cube.back[0] = this.cube.left[0];
            this.cube.back[1] = this.cube.left[1];
            this.cube.back[2] = this.cube.left[2];
            
            this.cube.left[0] = temp[0];
            this.cube.left[1] = temp[1];
            this.cube.left[2] = temp[2];
        } else {
            this.cube.front[0] = this.cube.left[0];
            this.cube.front[1] = this.cube.left[1];
            this.cube.front[2] = this.cube.left[2];
            
            this.cube.left[0] = this.cube.back[0];
            this.cube.left[1] = this.cube.back[1];
            this.cube.left[2] = this.cube.back[2];
            
            this.cube.back[0] = this.cube.right[0];
            this.cube.back[1] = this.cube.right[1];
            this.cube.back[2] = this.cube.right[2];
            
            this.cube.right[0] = temp[0];
            this.cube.right[1] = temp[1];
            this.cube.right[2] = temp[2];
        }
        
        this.updateCubieColors();
    }

    async rotateBottom(clockwise = true) {
        this.rotateFace(this.cube.bottom, clockwise);
        
        const layerCubies = this.cubies.filter(c => c.position.y === 2);
        await this.rotateLayerAnimation(layerCubies, 'y', clockwise ? 90 : -90);
        
        const temp = [this.cube.front[6], this.cube.front[7], this.cube.front[8]];
        if (clockwise) {
            this.cube.front[6] = this.cube.left[6];
            this.cube.front[7] = this.cube.left[7];
            this.cube.front[8] = this.cube.left[8];
            
            this.cube.left[6] = this.cube.back[6];
            this.cube.left[7] = this.cube.back[7];
            this.cube.left[8] = this.cube.back[8];
            
            this.cube.back[6] = this.cube.right[6];
            this.cube.back[7] = this.cube.right[7];
            this.cube.back[8] = this.cube.right[8];
            
            this.cube.right[6] = temp[0];
            this.cube.right[7] = temp[1];
            this.cube.right[8] = temp[2];
        } else {
            this.cube.front[6] = this.cube.right[6];
            this.cube.front[7] = this.cube.right[7];
            this.cube.front[8] = this.cube.right[8];
            
            this.cube.right[6] = this.cube.back[6];
            this.cube.right[7] = this.cube.back[7];
            this.cube.right[8] = this.cube.back[8];
            
            this.cube.back[6] = this.cube.left[6];
            this.cube.back[7] = this.cube.left[7];
            this.cube.back[8] = this.cube.left[8];
            
            this.cube.left[6] = temp[0];
            this.cube.left[7] = temp[1];
            this.cube.left[8] = temp[2];
        }
        
        this.updateCubieColors();
    }

    async rotateFront(clockwise = true) {
        this.rotateFace(this.cube.front, clockwise);
        
        const layerCubies = this.cubies.filter(c => c.position.z === 2);
        await this.rotateLayerAnimation(layerCubies, 'z', clockwise ? -90 : 90);
        
        const temp = [this.cube.top[6], this.cube.top[7], this.cube.top[8]];
        if (clockwise) {
            this.cube.top[6] = this.cube.left[8];
            this.cube.top[7] = this.cube.left[5];
            this.cube.top[8] = this.cube.left[2];
            
            this.cube.left[2] = this.cube.bottom[0];
            this.cube.left[5] = this.cube.bottom[1];
            this.cube.left[8] = this.cube.bottom[2];
            
            this.cube.bottom[0] = this.cube.right[6];
            this.cube.bottom[1] = this.cube.right[3];
            this.cube.bottom[2] = this.cube.right[0];
            
            this.cube.right[0] = temp[0];
            this.cube.right[3] = temp[1];
            this.cube.right[6] = temp[2];
        } else {
            this.cube.top[6] = this.cube.right[0];
            this.cube.top[7] = this.cube.right[3];
            this.cube.top[8] = this.cube.right[6];
            
            this.cube.right[0] = this.cube.bottom[2];
            this.cube.right[3] = this.cube.bottom[1];
            this.cube.right[6] = this.cube.bottom[0];
            
            this.cube.bottom[0] = this.cube.left[2];
            this.cube.bottom[1] = this.cube.left[5];
            this.cube.bottom[2] = this.cube.left[8];
            
            this.cube.left[2] = temp[8];
            this.cube.left[5] = temp[7];
            this.cube.left[8] = temp[6];
        }
        
        this.updateCubieColors();
    }

    async rotateBack(clockwise = true) {
        this.rotateFace(this.cube.back, clockwise);
        
        const layerCubies = this.cubies.filter(c => c.position.z === 0);
        await this.rotateLayerAnimation(layerCubies, 'z', clockwise ? 90 : -90);
        
        const temp = [this.cube.top[0], this.cube.top[1], this.cube.top[2]];
        if (clockwise) {
            this.cube.top[0] = this.cube.right[2];
            this.cube.top[1] = this.cube.right[5];
            this.cube.top[2] = this.cube.right[8];
            
            this.cube.right[2] = this.cube.bottom[8];
            this.cube.right[5] = this.cube.bottom[7];
            this.cube.right[8] = this.cube.bottom[6];
            
            this.cube.bottom[6] = this.cube.left[0];
            this.cube.bottom[7] = this.cube.left[3];
            this.cube.bottom[8] = this.cube.left[6];
            
            this.cube.left[0] = temp[2];
            this.cube.left[3] = temp[1];
            this.cube.left[6] = temp[0];
        } else {
            this.cube.top[0] = this.cube.left[6];
            this.cube.top[1] = this.cube.left[3];
            this.cube.top[2] = this.cube.left[0];
            
            this.cube.left[0] = this.cube.bottom[6];
            this.cube.left[3] = this.cube.bottom[7];
            this.cube.left[6] = this.cube.bottom[8];
            
            this.cube.bottom[6] = this.cube.right[8];
            this.cube.bottom[7] = this.cube.right[5];
            this.cube.bottom[8] = this.cube.right[2];
            
            this.cube.right[2] = temp[0];
            this.cube.right[5] = temp[1];
            this.cube.right[8] = temp[2];
        }
        
        this.updateCubieColors();
    }

    async rotateLeft(clockwise = true) {
        this.rotateFace(this.cube.left, clockwise);
        
        const layerCubies = this.cubies.filter(c => c.position.x === 0);
        await this.rotateLayerAnimation(layerCubies, 'x', clockwise ? 90 : -90);
        
        const temp = [this.cube.top[0], this.cube.top[3], this.cube.top[6]];
        if (clockwise) {
            this.cube.top[0] = this.cube.back[8];
            this.cube.top[3] = this.cube.back[5];
            this.cube.top[6] = this.cube.back[2];
            
            this.cube.back[2] = this.cube.bottom[6];
            this.cube.back[5] = this.cube.bottom[3];
            this.cube.back[8] = this.cube.bottom[0];
            
            this.cube.bottom[0] = this.cube.front[0];
            this.cube.bottom[3] = this.cube.front[3];
            this.cube.bottom[6] = this.cube.front[6];
            
            this.cube.front[0] = temp[0];
            this.cube.front[3] = temp[1];
            this.cube.front[6] = temp[2];
        } else {
            this.cube.top[0] = this.cube.front[0];
            this.cube.top[3] = this.cube.front[3];
            this.cube.top[6] = this.cube.front[6];
            
            this.cube.front[0] = this.cube.bottom[0];
            this.cube.front[3] = this.cube.bottom[3];
            this.cube.front[6] = this.cube.bottom[6];
            
            this.cube.bottom[0] = this.cube.back[8];
            this.cube.bottom[3] = this.cube.back[5];
            this.cube.bottom[6] = this.cube.back[2];
            
            this.cube.back[2] = temp[6];
            this.cube.back[5] = temp[3];
            this.cube.back[8] = temp[0];
        }
        
        this.updateCubieColors();
    }

    async rotateRight(clockwise = true) {
        this.rotateFace(this.cube.right, clockwise);
        
        const layerCubies = this.cubies.filter(c => c.position.x === 2);
        await this.rotateLayerAnimation(layerCubies, 'x', clockwise ? -90 : 90);
        
        const temp = [this.cube.top[2], this.cube.top[5], this.cube.top[8]];
        if (clockwise) {
            this.cube.top[2] = this.cube.front[2];
            this.cube.top[5] = this.cube.front[5];
            this.cube.top[8] = this.cube.front[8];
            
            this.cube.front[2] = this.cube.bottom[2];
            this.cube.front[5] = this.cube.bottom[5];
            this.cube.front[8] = this.cube.bottom[8];
            
            this.cube.bottom[2] = this.cube.back[6];
            this.cube.bottom[5] = this.cube.back[3];
            this.cube.bottom[8] = this.cube.back[0];
            
            this.cube.back[0] = temp[8];
            this.cube.back[3] = temp[5];
            this.cube.back[6] = temp[2];
        } else {
            this.cube.top[2] = this.cube.back[6];
            this.cube.top[5] = this.cube.back[3];
            this.cube.top[8] = this.cube.back[0];
            
            this.cube.back[0] = this.cube.bottom[8];
            this.cube.back[3] = this.cube.bottom[5];
            this.cube.back[6] = this.cube.bottom[2];
            
            this.cube.bottom[2] = this.cube.front[2];
            this.cube.bottom[5] = this.cube.front[5];
            this.cube.bottom[8] = this.cube.front[8];
            
            this.cube.front[2] = temp[0];
            this.cube.front[5] = temp[1];
            this.cube.front[8] = temp[2];
        }
        
        this.updateCubieColors();
    }

    checkWinCondition() {
        const isSolved = Object.values(this.cube).every(face => {
            const firstColor = face[0];
            return face.every(cell => cell === firstColor);
        });
        
        if (isSolved) {
            this.onWin();
        }
    }

    onWin() {
        const message = document.getElementById('message');
        message.textContent = `🎉 축하합니다! ${this.moveCount}번 만에 퍼즐을 완성했습니다! 🎉`;
        message.classList.remove('hidden');
        message.classList.add('celebrating');
        
        setTimeout(() => {
            message.classList.remove('celebrating');
        }, 3000);
    }

    showHint() {
        const message = document.getElementById('message');
        message.textContent = '💡 힌트: PC는 마우스로 드래그하여 회전, 모바일은 2개 손가락으로 드래그하거나 큐브를 터치하여 레이어를 회전하세요!';
        message.classList.remove('hidden');
        
        setTimeout(() => {
            message.classList.add('hidden');
        }, 3000);
    }

    resetCube() {
        this.cube = this.createSolvedCube();
        this.moveCount = 0;
        document.getElementById('moves').textContent = '0';
        document.getElementById('message').classList.add('hidden');
        
        // Reset all cubie positions
        this.cubies.forEach((cubie, index) => {
            const x = Math.floor(index / 9);
            const y = Math.floor((index % 9) / 3);
            const z = index % 3;
            
            cubie.position = { x, y, z };
            cubie.rotation = { x: 0, y: 0, z: 0 };
            
            const offset = (this.cubieSize + this.gap) - (this.cubieSize + this.gap) * 1.5;
            const posX = x * (this.cubieSize + this.gap) + offset;
            const posY = -y * (this.cubieSize + this.gap) - offset;
            const posZ = z * (this.cubieSize + this.gap) + offset;
            
            cubie.element.style.transform = `translate3d(${posX}px, ${posY}px, ${posZ}px)`;
        });
        
        this.updateCubieColors();
        setTimeout(() => this.scrambleCube(), 100);
    }

    onWindowResize() {
        const size = Math.min(window.innerWidth * 0.8, 300);
        this.cubeElement.style.width = size + 'px';
        this.cubeElement.style.height = size + 'px';
    }
}

// Initialize game when page loads
window.addEventListener('DOMContentLoaded', () => {
    new CubePuzzleGame();
});
