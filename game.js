(() => {
	'use strict';

	if (!window.THREE) {
		console.error('Three.js failed to load.');
		return;
	}

	const stageEl = document.getElementById('cube-stage');
	const moveCountEl = document.getElementById('move-count');
	const moveLogEl = document.getElementById('move-log');
	const messageEl = document.getElementById('message');
	const scrambleBtn = document.getElementById('scramble-btn');
	const resetBtn = document.getElementById('reset-btn');
	const hintBtn = document.getElementById('hint-btn');
	const guideBtn = document.getElementById('guide-btn');
	const focusBtn = document.getElementById('focus-btn');
	const focusExitBtn = document.getElementById('focus-exit-btn');
	const customizeKeysBtn = document.getElementById('customize-keys-btn');
	const speedSlider = document.getElementById('speed-slider');
	const speedValueEl = document.getElementById('speed-value');
	const cubeSizeSelect = document.getElementById('cube-size-select');
	const cubeTypeSelect = document.getElementById('cube-type-select');
	const keyboardModal = document.getElementById('keyboard-modal');
	const closeModalBtn = document.getElementById('close-modal-btn');
	const saveKeysBtn = document.getElementById('save-keys-btn');
	const resetKeysBtn = document.getElementById('reset-keys-btn');
	const backViewBtn = document.getElementById('back-view-btn');
	const gameTimerEl = document.getElementById('game-timer');

	// Guide modal elements
	const guideModal = document.getElementById('guide-modal');
	const closeGuideModalBtn = document.getElementById('close-guide-modal-btn');

	// Victory modal elements
	const victoryModal = document.getElementById('victory-modal');
	const closeVictoryModalBtn = document.getElementById('close-victory-modal-btn');
	const victoryMoveCount = document.getElementById('victory-move-count');
	const victoryTime = document.getElementById('victory-time');
	const nicknameInput = document.getElementById('nickname-input');
	const saveScoreBtn = document.getElementById('save-score-btn');
	const skipLeaderboardBtn = document.getElementById('skip-leaderboard-btn');

	// Leaderboard elements
	const leaderboardList = document.getElementById('leaderboard-list');
	const leaderboardStatus = document.getElementById('leaderboard-status');
	const refreshLeaderboardBtn = document.getElementById('refresh-leaderboard-btn');

	if (!stageEl || !moveCountEl || !moveLogEl || !messageEl) {
		console.error('Required DOM elements are missing.');
		return;
	}

	const AXIS_VECTORS = {
		x: new THREE.Vector3(1, 0, 0),
		y: new THREE.Vector3(0, 1, 0),
		z: new THREE.Vector3(0, 0, 1)
	};

	const FACE_NOTATION = {
		x: { 1: 'R', '-1': 'L' },
		y: { 1: 'U', '-1': 'D' },
		z: { 1: 'F', '-1': 'B' }
	};

	const COLORS = {
		base: 0x0a0a0a, // Darker black for better contrast
		right: 0xff3333, // Brighter red
		left: 0xff8833, // Brighter orange
		up: 0xffffff,   // Pure white
		down: 0xffdd00, // Brighter yellow
		front: 0x00dd44, // Brighter green
		back: 0x3388ff  // Brighter blue
	};

	// Tolerance for floating point comparisons
	const POSITION_TOLERANCE = 0.01;

	const cubelets = [];
	const moveQueue = [];
	const pointerStates = new Map();

	const raycaster = new THREE.Raycaster();
	const tmpVec2 = new THREE.Vector2();
	const tmpVec3 = new THREE.Vector3();
	const tmpQuat = new THREE.Quaternion();
	const tmpMatrix4 = new THREE.Matrix4();
	const tmpMatrix3 = new THREE.Matrix3();

	const state = {
		moveCount: 0,
		latestMessage: '게임을 초기화하는 중...',
		moveHistory: [],
		isRotating: false,
		isBackFaceView: false,
		gameStartTime: null,
		gameInProgress: false,
		lastGameTime: 0,
		rotationSpeed: 200,
		cubeSize: 3,  // Add cube size state (2-7)
		cubeType: 'normal'  // Add cube type state ('normal' or 'mirror')
	};

	// Keyboard shortcut settings - customizable
	const defaultKeyboardSettings = {
		U: 'KeyU',
		D: 'KeyD',
		L: 'KeyL',
		R: 'KeyR',
		F: 'KeyF',
		B: 'KeyB',
		toggleTransparency: 'KeyT',
		cameraRelativeMode: true,  // true = camera-relative, false = fixed-axis
		autoScramble: true  // true = auto-scramble on start, false = start solved
	};

	const keyboardSettings = loadKeyboardSettings();

	const cameraTarget = new THREE.Vector3(0, 0, 0);
	const orbitState = {
		theta: Math.PI / 4,
		phi: Math.PI / 4,
		pointerId: null,
		startTheta: null,
		startPhi: null,
		startPos: null
	};

	const cameraLimits = {
		minPhi: 0.2,
		maxPhi: Math.PI - 0.2,
		minDistance: 3.5,
		maxDistance: 24
	};

	let cameraDistance = 7.4;
	let dragState = null;
	let gestureState = null;

	const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1.1; // Slightly brighter
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	renderer.physicallyCorrectLights = true; // More realistic lighting
	renderer.domElement.style.display = 'block';
	renderer.domElement.style.width = '100%';
	renderer.domElement.style.height = '100%';
	renderer.domElement.style.touchAction = 'none';
	renderer.domElement.setAttribute('aria-label', '3x3 큐브 인터랙티브 캔버스');
	stageEl.appendChild(renderer.domElement);

	const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 80);
	camera.position.set(5, 4, 7);
	camera.up.set(0, 1, 0);

	const scene = new THREE.Scene();
	scene.background = null;
	scene.fog = new THREE.Fog(0x0a0f1e, 15, 30); // Add atmospheric depth

	function changeCubeSize(newSize) {
		state.cubeSize = newSize;
		buildCube();
		resetCube();
		state.moveHistory.length = 0;
		state.moveCount = 0;
		state.gameInProgress = false;
		state.gameStartTime = null;
		updateHud();
		setMessage(`큐브 크기가 ${newSize}x${newSize}로 변경되었습니다. 섞기 버튼을 눌러주세요!`);
		
		// Adjust camera distance based on cube size
		// Use a larger multiplier to ensure larger cubes are fully visible from the start
		const baseDist = 7.4;
		cameraDistance = baseDist + (newSize - 3) * 2.0;
		updateCameraPosition();
	}

	addEnvironment();
	buildCube();
	updateCameraPosition();
	onResize();

	if (window.ResizeObserver) {
		const resizeObserver = new ResizeObserver(onResize);
		resizeObserver.observe(stageEl);
	}
	window.addEventListener('resize', onResize);

	// Handle fullscreen change events
	document.addEventListener('fullscreenchange', handleFullscreenChange);
	document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
	document.addEventListener('msfullscreenchange', handleFullscreenChange);

	function handleFullscreenChange() {
		const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
		const isFocusMode = document.body.classList.contains('focus-mode');
		
		// If we exit fullscreen but still in focus mode, exit focus mode too
		if (!isFullscreen && isFocusMode) {
			document.body.classList.remove('focus-mode');
			if (focusBtn) {
				focusBtn.textContent = '집중 모드';
			}
			setTimeout(() => {
				onResize();
			}, 100);
		}
	}

	bindUIEvents();
	bindPointerEvents();
	bindKeyboardShortcuts();

	setMessage(state.latestMessage);
	animate();

	// Auto-scramble on game initialization to prevent cheating
	// Delay allows the 3D scene to fully render before scrambling begins
	// Can be disabled in settings for easier testing
	const AUTO_SCRAMBLE_DELAY_MS = 500;
	setTimeout(() => {
		if (keyboardSettings.autoScramble) {
			scrambleCube();
		} else {
			setMessage('자동 섞기가 비활성화되어 있습니다. 섞기 버튼으로 게임을 시작하세요!');
		}
	}, AUTO_SCRAMBLE_DELAY_MS);

	function addEnvironment() {
		// Enhanced ambient lighting
		scene.add(new THREE.HemisphereLight(0xffffff, 0x1e293b, 1.2));

		// Main directional light with enhanced shadow quality
		const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
		dirLight.position.set(8, 12, 10);
		dirLight.castShadow = true;
		dirLight.shadow.mapSize.set(4096, 4096);
		dirLight.shadow.camera.near = 1;
		dirLight.shadow.camera.far = 35;
		dirLight.shadow.bias = -0.0001;
		dirLight.shadow.radius = 2;
		scene.add(dirLight);

		// Add fill light from the opposite side
		const fillLight = new THREE.DirectionalLight(0x7dd3fc, 0.6);
		fillLight.position.set(-6, 4, -8);
		scene.add(fillLight);

		// Rim light for edge definition
		const rimLight = new THREE.DirectionalLight(0xa5f3fc, 0.8);
		rimLight.position.set(-10, -8, -6);
		scene.add(rimLight);

		// Add point lights for extra sparkle
		const pointLight1 = new THREE.PointLight(0xffffff, 0.5, 20);
		pointLight1.position.set(5, 8, 5);
		scene.add(pointLight1);

		const pointLight2 = new THREE.PointLight(0x38bdf8, 0.4, 15);
		pointLight2.position.set(-5, -5, 5);
		scene.add(pointLight2);

		// Add a subtle ground plane for reflection
		const groundGeometry = new THREE.PlaneGeometry(20, 20);
		const groundMaterial = new THREE.MeshStandardMaterial({
			color: 0x0f172a,
			roughness: 0.8,
			metalness: 0.2,
			opacity: 0.3,
			transparent: true
		});
		const ground = new THREE.Mesh(groundGeometry, groundMaterial);
		ground.rotation.x = -Math.PI / 2;
		ground.position.y = -2.5;
		ground.receiveShadow = true;
		scene.add(ground);
	}

	// Helper function: Get size multiplier for mirror cube pieces based on layer position
	function getMirrorSizeMultiplier(pos, halfSize, isMirrorMode) {
		if (!isMirrorMode) return 1.0;
		
		// Normalize position to 0-1 range (0 = smallest layer, 1 = largest layer)
		const normalized = (pos + halfSize) / (halfSize * 2);
		
		// Use specified ratios for layer sizes: 14, 19, 24
		// (relative to middle layer 19 as baseline)
		// Multipliers: 14/19 ≈ 0.737, 19/19 = 1.0, 24/19 ≈ 1.263
		const MIN_RATIO = 14 / 19;  // ≈ 0.737
		const MAX_RATIO = 24 / 19;  // ≈ 1.263
		return MIN_RATIO + (normalized * (MAX_RATIO - MIN_RATIO));
	}
	
	// Helper function: Calculate physical position for mirror cube pieces
	// so that pieces touch each other (no gaps between layers)
	function getMirrorPosition(pos, halfSize, cubeletSize, spacing, isMirrorMode) {
		if (!isMirrorMode) return pos * spacing;
		
		// Calculate cumulative position from the center (0)
		// Pieces should touch each other, so position = sum of all piece sizes before this one
		const step = 1;
		let cumulativePos = 0;
		
		if (pos > 0) {
			// Moving in positive direction from center
			for (let p = 0; p < pos; p += step) {
				const currentSize = cubeletSize * getMirrorSizeMultiplier(p, halfSize, isMirrorMode);
				const nextSize = cubeletSize * getMirrorSizeMultiplier(p + step, halfSize, isMirrorMode);
				cumulativePos += (currentSize + nextSize) / 2;
			}
		} else if (pos < 0) {
			// Moving in negative direction from center
			for (let p = 0; p > pos; p -= step) {
				const currentSize = cubeletSize * getMirrorSizeMultiplier(p, halfSize, isMirrorMode);
				const prevSize = cubeletSize * getMirrorSizeMultiplier(p - step, halfSize, isMirrorMode);
				cumulativePos -= (currentSize + prevSize) / 2;
			}
		}
		// pos === 0 stays at 0
		
		return cumulativePos;
	}

	function buildCube() {
		// Clear existing cubelets
		cubelets.length = 0;
		
		// Remove old cube group if it exists
		if (scene.userData.cubeGroup) {
			scene.remove(scene.userData.cubeGroup);
			scene.userData.cubeGroup.traverse((child) => {
				if (child.geometry) child.geometry.dispose();
				if (child.material) {
					if (Array.isArray(child.material)) {
						child.material.forEach(m => m.dispose());
					} else {
						child.material.dispose();
					}
				}
			});
		}
		
		const cubeGroup = new THREE.Group();
		scene.add(cubeGroup);

		const n = state.cubeSize;  // Grid size (2-7)
		const isMirrorMode = state.cubeType === 'mirror';
		const cubeletSize = 0.92; // Slightly smaller for visible gaps
		const spacing = 1.0; // Spacing between cubelets to show black body
		
		// Mirror cube configuration
		const MIRROR_COLOR = 0xFFE87C; // Much brighter golden color (훨씬 밝은 금색)
		const MIN_MIRROR_SCALE = 0.6; // Thinnest piece scale (deprecated, using ratios instead)
		const MIRROR_SCALE_RANGE = 0.8; // Range from thinnest to thickest (deprecated, using ratios instead)
		const MIRROR_TILT_X = 0.15; // X-axis rotation for tilted aesthetic
		const MIRROR_TILT_Y = 0.25; // Y-axis rotation for tilted aesthetic
		const MIRROR_TILT_Z = 0.1;  // Z-axis rotation for tilted aesthetic
		
		const geometry = new THREE.BoxGeometry(cubeletSize, cubeletSize, cubeletSize, 2, 2, 2);
		
		// Add rounded edges to the geometry
		const createRoundedGeometry = (sizeX, sizeY, sizeZ) => {
			const geom = new THREE.BoxGeometry(sizeX, sizeY, sizeZ, 4, 4, 4);
			
			// Apply edge rounding by modifying vertex positions
			const positionAttr = geom.attributes.position;
			const vertex = new THREE.Vector3();
			const edgeRadius = 0.08; // Radius for rounded edges
			
			for (let i = 0; i < positionAttr.count; i++) {
				vertex.fromBufferAttribute(positionAttr, i);
				
				// Calculate distance from center for each axis
				const dx = Math.abs(vertex.x) - (sizeX / 2 - edgeRadius);
				const dy = Math.abs(vertex.y) - (sizeY / 2 - edgeRadius);
				const dz = Math.abs(vertex.z) - (sizeZ / 2 - edgeRadius);
				
				// Round the corners and edges
				if (dx > 0 && dy > 0 && dz > 0) {
					// Corner rounding
					const cornerDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
					if (cornerDist > 0) {
						const factor = edgeRadius / cornerDist;
						vertex.x = Math.sign(vertex.x) * (sizeX / 2 - edgeRadius + dx * factor);
						vertex.y = Math.sign(vertex.y) * (sizeY / 2 - edgeRadius + dy * factor);
						vertex.z = Math.sign(vertex.z) * (sizeZ / 2 - edgeRadius + dz * factor);
					}
				} else if (dx > 0 && dy > 0) {
					// Edge rounding XY
					const edgeDist = Math.sqrt(dx * dx + dy * dy);
					if (edgeDist > 0) {
						const factor = edgeRadius / edgeDist;
						vertex.x = Math.sign(vertex.x) * (sizeX / 2 - edgeRadius + dx * factor);
						vertex.y = Math.sign(vertex.y) * (sizeY / 2 - edgeRadius + dy * factor);
					}
				} else if (dx > 0 && dz > 0) {
					// Edge rounding XZ
					const edgeDist = Math.sqrt(dx * dx + dz * dz);
					if (edgeDist > 0) {
						const factor = edgeRadius / edgeDist;
						vertex.x = Math.sign(vertex.x) * (sizeX / 2 - edgeRadius + dx * factor);
						vertex.z = Math.sign(vertex.z) * (sizeZ / 2 - edgeRadius + dz * factor);
					}
				} else if (dy > 0 && dz > 0) {
					// Edge rounding YZ
					const edgeDist = Math.sqrt(dy * dy + dz * dz);
					if (edgeDist > 0) {
						const factor = edgeRadius / edgeDist;
						vertex.y = Math.sign(vertex.y) * (sizeY / 2 - edgeRadius + dy * factor);
						vertex.z = Math.sign(vertex.z) * (sizeZ / 2 - edgeRadius + dz * factor);
					}
				}
				
				positionAttr.setXYZ(i, vertex.x, vertex.y, vertex.z);
			}
			
			geom.computeVertexNormals();
			return geom;
		};
		
		// Create default geometry for normal mode (will be reused)
		const roundedGeometry = isMirrorMode ? null : createRoundedGeometry(cubeletSize, cubeletSize, cubeletSize);

		const faceMaterialsCache = new Map();

		const getFaceMaterial = (color, isMirror = false) => {
			const cacheKey = isMirror ? `mirror_${color}` : color;
			if (!faceMaterialsCache.has(cacheKey)) {
				let material;
				
				if (isMirror) {
					// Mirror cube: all pieces are metallic gold with much enhanced brightness
					material = new THREE.MeshPhysicalMaterial({
						color: color, // Use the MIRROR_COLOR constant (golden)
						roughness: 0.02, // Even smoother for better reflection
						metalness: 1.0, // Maximum metalness
						reflectivity: 1.0,
						clearcoat: 1.0,
						clearcoatRoughness: 0.02, // Smoother clearcoat
						emissive: 0xFFD700, // Bright golden emissive glow
						emissiveIntensity: 0.6, // Much higher emissive intensity for brightness
						polygonOffset: true,
						polygonOffsetFactor: -1
					});
				} else {
					const isColoredFace = color !== COLORS.base;
					
					// Use MeshPhysicalMaterial for colored stickers (glossy, reflective)
					// Use MeshStandardMaterial for black body (matte)
					material = isColoredFace 
						? new THREE.MeshPhysicalMaterial({
							color,
							roughness: 0.2,
							metalness: 0.1,
							reflectivity: 0.5,
							polygonOffset: true,
							polygonOffsetFactor: -1,
							emissive: color,
							emissiveIntensity: 0.1
						})
						: new THREE.MeshStandardMaterial({
							color,
							roughness: 0.9,
							metalness: 0.15,
							polygonOffset: true,
							polygonOffsetFactor: 0,
							emissive: 0x000000,
							emissiveIntensity: 0
						});
				}
				faceMaterialsCache.set(cacheKey, material);
			}
			return faceMaterialsCache.get(cacheKey);
		};

		// Calculate bounds for the grid
		// For odd cubes (3x3, 5x5): positions are integers from -(n-1)/2 to (n-1)/2
		// For even cubes (2x2, 4x4): positions are half-integers from -(n-1)/2 to (n-1)/2
		const halfSize = (n - 1) / 2;
		const isEven = n % 2 === 0;
		const step = 1; // Always use step of 1
		
		for (let x = -halfSize; x <= halfSize; x += step) {
			for (let y = -halfSize; y <= halfSize; y += step) {
				for (let z = -halfSize; z <= halfSize; z += step) {
					// Skip the center piece for odd cubes only (it's never visible)
					if (x === 0 && y === 0 && z === 0 && !isEven) {
						continue;
					}

					// For mirror mode, calculate individual piece dimensions
					let pieceGeometry;
					if (isMirrorMode) {
						const sizeX = cubeletSize * getMirrorSizeMultiplier(x, halfSize, isMirrorMode);
						const sizeY = cubeletSize * getMirrorSizeMultiplier(y, halfSize, isMirrorMode);
						const sizeZ = cubeletSize * getMirrorSizeMultiplier(z, halfSize, isMirrorMode);
						pieceGeometry = createRoundedGeometry(sizeX, sizeY, sizeZ);
					} else {
						pieceGeometry = roundedGeometry;
					}

					// Determine which faces should be colored
					// Only the outer layer faces get colors
					const materials = isMirrorMode ? [
						// Mirror mode: all faces are metallic silver
						getFaceMaterial(MIRROR_COLOR, true),
						getFaceMaterial(MIRROR_COLOR, true),
						getFaceMaterial(MIRROR_COLOR, true),
						getFaceMaterial(MIRROR_COLOR, true),
						getFaceMaterial(MIRROR_COLOR, true),
						getFaceMaterial(MIRROR_COLOR, true)
					] : [
						// Normal mode: colored faces
						getFaceMaterial(x === halfSize ? COLORS.right : COLORS.base),
						getFaceMaterial(x === -halfSize ? COLORS.left : COLORS.base),
						getFaceMaterial(y === halfSize ? COLORS.up : COLORS.base),
						getFaceMaterial(y === -halfSize ? COLORS.down : COLORS.base),
						getFaceMaterial(z === halfSize ? COLORS.front : COLORS.base),
						getFaceMaterial(z === -halfSize ? COLORS.back : COLORS.base)
					];

					const mesh = new THREE.Mesh(pieceGeometry, materials);
					mesh.castShadow = true;
					mesh.receiveShadow = true;
					
					// For mirror mode, use calculated positions; for normal mode, use uniform spacing
					const posX = isMirrorMode ? getMirrorPosition(x, halfSize, cubeletSize, spacing, isMirrorMode) : x * spacing;
					const posY = isMirrorMode ? getMirrorPosition(y, halfSize, cubeletSize, spacing, isMirrorMode) : y * spacing;
					const posZ = isMirrorMode ? getMirrorPosition(z, halfSize, cubeletSize, spacing, isMirrorMode) : z * spacing;
					mesh.position.set(posX, posY, posZ);

					// Create invisible picking helper to cover gaps between cubes
					// This makes dragging more forgiving - users can drag near edges
					const pickingGeometry = new THREE.BoxGeometry(spacing, spacing, spacing);
					const pickingMaterial = new THREE.MeshBasicMaterial({
						visible: false
					});
					const pickingHelper = new THREE.Mesh(pickingGeometry, pickingMaterial);
					pickingHelper.position.set(0, 0, 0); // Position relative to cubelet mesh
					mesh.add(pickingHelper); // Add as child so it moves with the cubelet

					const cubelet = {
						mesh,
						pickingHelper,
						logicalPosition: new THREE.Vector3(x, y, z),
						initialLogicalPosition: new THREE.Vector3(x, y, z),
						// Store initial physical position for proper reset (especially in mirror mode)
						// Note: This is recalculated when cube is rebuilt (e.g., when switching types)
						initialPhysicalPosition: new THREE.Vector3(posX, posY, posZ),
						orientation: {
							x: new THREE.Vector3(1, 0, 0),
							y: new THREE.Vector3(0, 1, 0),
							z: new THREE.Vector3(0, 0, 1)
						},
						initialOrientation: {
							x: new THREE.Vector3(1, 0, 0),
							y: new THREE.Vector3(0, 1, 0),
							z: new THREE.Vector3(0, 0, 1)
						}
					};

					mesh.userData.cubelet = cubelet;
					pickingHelper.userData.cubelet = cubelet;
					cubeGroup.add(mesh);
					cubelets.push(cubelet);
				}
			}
		}

		// Add a slight rotation to the cube group for mirror mode aesthetic
		if (isMirrorMode) {
			cubeGroup.rotation.set(MIRROR_TILT_X, MIRROR_TILT_Y, MIRROR_TILT_Z); // Tilted axes for visual appeal
			
			// Since getMirrorPosition calculates cumulative positions from center (0)
			// with pieces touching each other, the cube should be naturally centered.
			// For a 3x3: positions at -1, 0, +1 with sizes 0.737, 1.0, 1.263
			// result in symmetric positioning around the origin.
		}

		scene.userData.cubeGroup = cubeGroup;
		scene.userData.spacing = spacing;
		scene.userData.cubeletSize = cubeletSize;
		scene.userData.cubeSize = n;
		scene.userData.halfSize = halfSize;
	}

	function resetCube() {
		const spacing = scene.userData.spacing;
		cubelets.forEach((cubelet) => {
			cubelet.logicalPosition.copy(cubelet.initialLogicalPosition);
			cubelet.orientation.x.copy(cubelet.initialOrientation.x);
			cubelet.orientation.y.copy(cubelet.initialOrientation.y);
			cubelet.orientation.z.copy(cubelet.initialOrientation.z);

			// Use stored initial physical position (important for mirror cube mode)
			if (cubelet.initialPhysicalPosition) {
				cubelet.mesh.position.copy(cubelet.initialPhysicalPosition);
			} else {
				// Fallback for normal cubes or old data
				cubelet.mesh.position.set(
					cubelet.logicalPosition.x * spacing,
					cubelet.logicalPosition.y * spacing,
					cubelet.logicalPosition.z * spacing
				);
			}

			const basisMatrix = new THREE.Matrix4().makeBasis(
				cubelet.orientation.x,
				cubelet.orientation.y,
				cubelet.orientation.z
			);
			cubelet.mesh.quaternion.setFromRotationMatrix(basisMatrix);
		});
	}

	function loadKeyboardSettings() {
		try {
			const saved = localStorage.getItem('cubeGameKeyboardSettings');
			if (saved) {
				return { ...defaultKeyboardSettings, ...JSON.parse(saved) };
			}
		} catch (error) {
			console.warn('Failed to load keyboard settings:', error);
		}
		return { ...defaultKeyboardSettings };
	}

	function saveKeyboardSettings() {
		try {
			localStorage.setItem('cubeGameKeyboardSettings', JSON.stringify(keyboardSettings));
		} catch (error) {
			console.warn('Failed to save keyboard settings:', error);
		}
	}

	function openKeyboardModal() {
		// Populate current settings
		Object.keys(keyboardSettings).forEach((key) => {
			// Skip non-key settings
			if (key === 'cameraRelativeMode' || key === 'autoScramble') return;
			
			const input = document.getElementById(`key-${key}`);
			const display = document.querySelector(`.key-display[data-key="${key}"]`);
			if (input) {
				input.value = formatKeyCode(keyboardSettings[key]);
			}
			if (display) {
				display.textContent = formatKeyCode(keyboardSettings[key]);
			}
		});

		// Set camera relative mode checkbox
		const cameraRelativeCheckbox = document.getElementById('camera-relative-mode');
		if (cameraRelativeCheckbox) {
			cameraRelativeCheckbox.checked = keyboardSettings.cameraRelativeMode;
		}

		// Set auto-scramble mode checkbox
		const autoScrambleCheckbox = document.getElementById('auto-scramble-mode');
		if (autoScrambleCheckbox) {
			autoScrambleCheckbox.checked = keyboardSettings.autoScramble;
		}

		keyboardModal.style.display = 'flex';
		setupKeyListeners();
	}

	function closeKeyboardModal() {
		keyboardModal.style.display = 'none';
		removeKeyListeners();
	}

	function openGuideModal() {
		guideModal.style.display = 'flex';
	}

	function closeGuideModal() {
		guideModal.style.display = 'none';
	}

	function formatKeyCode(code) {
		// Handle non-string values (e.g., boolean settings)
		if (typeof code !== 'string') {
			return '';
		}
		// Convert KeyU to U, KeyT to T, etc.
		if (code.startsWith('Key')) {
			return code.substring(3);
		}
		return code;
	}

	function setupKeyListeners() {
		const inputs = keyboardModal.querySelectorAll('.key-mapping-item input');
		inputs.forEach((input) => {
			input.addEventListener('focus', onKeyInputFocus);
			input.addEventListener('blur', onKeyInputBlur);
		});
	}

	function removeKeyListeners() {
		const inputs = keyboardModal.querySelectorAll('.key-mapping-item input');
		inputs.forEach((input) => {
			input.removeEventListener('focus', onKeyInputFocus);
			input.removeEventListener('blur', onKeyInputBlur);
		});
	}

	function onKeyInputFocus(event) {
		const input = event.target;
		input.classList.add('listening');
		input.value = '키를 누르세요...';

		const keydownHandler = (e) => {
			e.preventDefault();
			const keyId = input.id.replace('key-', '');
			const newKeyCode = e.code;

			// Check for duplicates
			const duplicate = Object.entries(keyboardSettings).find(
				([key, code]) => code === newKeyCode && key !== keyId
			);

			if (duplicate) {
				input.value = `충돌: ${duplicate[0]} 키와 중복`;
				setTimeout(() => {
					input.value = formatKeyCode(keyboardSettings[keyId]);
					input.blur();
				}, 1500);
			} else {
				keyboardSettings[keyId] = newKeyCode;
				input.value = formatKeyCode(newKeyCode);
				const display = document.querySelector(`.key-display[data-key="${keyId}"]`);
				if (display) {
					display.textContent = formatKeyCode(newKeyCode);
				}
				input.blur();
			}
		};

		input.addEventListener('keydown', keydownHandler, { once: true });
	}

	function onKeyInputBlur(event) {
		const input = event.target;
		input.classList.remove('listening');
		const keyId = input.id.replace('key-', '');
		input.value = formatKeyCode(keyboardSettings[keyId]);
	}

	function refreshModalDisplay() {
		Object.keys(keyboardSettings).forEach((key) => {
			// Skip non-key settings
			if (key === 'cameraRelativeMode' || key === 'autoScramble') return;
			
			const input = document.getElementById(`key-${key}`);
			const display = document.querySelector(`.key-display[data-key="${key}"]`);
			if (input) {
				input.value = formatKeyCode(keyboardSettings[key]);
			}
			if (display) {
				display.textContent = formatKeyCode(keyboardSettings[key]);
			}
		});
		
		// Update camera relative mode checkbox
		const cameraRelativeCheckbox = document.getElementById('camera-relative-mode');
		if (cameraRelativeCheckbox) {
			cameraRelativeCheckbox.checked = keyboardSettings.cameraRelativeMode;
		}
		
		// Update auto-scramble mode checkbox
		const autoScrambleCheckbox = document.getElementById('auto-scramble-mode');
		if (autoScrambleCheckbox) {
			autoScrambleCheckbox.checked = keyboardSettings.autoScramble;
		}
	}

	function resetKeyboardSettings() {
		Object.assign(keyboardSettings, defaultKeyboardSettings);
		saveKeyboardSettings();
		refreshModalDisplay();
		setMessage('단축키가 기본값으로 초기화되었습니다.');
	}

	function bindUIEvents() {
		scrambleBtn?.addEventListener('click', () => {
			if (state.isRotating) {
				setMessage('회전이 끝난 후 다시 시도하세요.');
				return;
			}
			scrambleCube();
		});

		resetBtn?.addEventListener('click', () => {
			if (state.isRotating || moveQueue.length) {
				setMessage('회전이 끝난 후 리셋할 수 있습니다.');
				return;
			}
			resetCube();
			state.moveHistory.length = 0;
			state.moveCount = 0;
			state.gameInProgress = false;
			state.gameStartTime = null;
			updateHud();
			setMessage('큐브가 초기화되었습니다.');
		});

		hintBtn?.addEventListener('click', () => {
			if (state.isRotating || moveQueue.length) {
				setMessage('현재 회전이 완료된 후 힌트를 사용할 수 있습니다.');
				return;
			}
			if (!state.moveHistory.length) {
				setMessage('되돌릴 이동이 없습니다.');
				return;
			}

			const lastMove = state.moveHistory.pop();
			state.moveCount = Math.max(0, state.moveCount - 1);
			updateHud();

			const inverseMove = {
				axis: lastMove.axis,
				layer: lastMove.layer,
				direction: -lastMove.direction,
				record: false,
				notation: `${lastMove.notation}' 되돌리기` // message context only
			};

			enqueueMove({
				...inverseMove,
				onComplete: () => {
					updateHud();
					// Check if cube is solved after hint/undo
					if (isCubeSolved()) {
						handleVictory();
					} else {
						setMessage('최근 이동을 되돌렸습니다.');
					}
				}
			});
		});

		focusBtn?.addEventListener('click', () => {
			toggleFocusMode();
		});

		focusExitBtn?.addEventListener('click', () => {
			toggleFocusMode();
		});
		customizeKeysBtn?.addEventListener('click', () => {
			openKeyboardModal();
		});

		closeModalBtn?.addEventListener('click', () => {
			closeKeyboardModal();
		});

		saveKeysBtn?.addEventListener('click', () => {
			// Save camera relative mode checkbox state
			const cameraRelativeCheckbox = document.getElementById('camera-relative-mode');
			if (cameraRelativeCheckbox) {
				keyboardSettings.cameraRelativeMode = cameraRelativeCheckbox.checked;
			}
			
			// Save auto-scramble mode checkbox state
			const autoScrambleCheckbox = document.getElementById('auto-scramble-mode');
			if (autoScrambleCheckbox) {
				keyboardSettings.autoScramble = autoScrambleCheckbox.checked;
			}
			
			saveKeyboardSettings();
			closeKeyboardModal();
			setMessage('단축키 설정이 저장되었습니다.');
		});

		resetKeysBtn?.addEventListener('click', () => {
			resetKeyboardSettings();
		});

		// Close modal on background click
		keyboardModal?.addEventListener('click', (event) => {
			if (event.target === keyboardModal) {
				closeKeyboardModal();
			}
		});

		// Guide modal event listeners
		guideBtn?.addEventListener('click', () => {
			openGuideModal();
		});

		closeGuideModalBtn?.addEventListener('click', () => {
			closeGuideModal();
		});

		// Close guide modal on background click
		guideModal?.addEventListener('click', (event) => {
			if (event.target === guideModal) {
				closeGuideModal();
			}
		});

		// Speed control events
		speedSlider?.addEventListener('input', (event) => {
			state.rotationSpeed = parseInt(event.target.value);
			speedValueEl.textContent = `${state.rotationSpeed}ms`;
		});

		// Cube size control events
		cubeSizeSelect?.addEventListener('change', (event) => {
			if (state.isRotating || moveQueue.length) {
				setMessage('회전이 끝난 후 큐브 크기를 변경할 수 있습니다.');
				event.target.value = state.cubeSize; // Reset to current value
				return;
			}
			
			const newSize = parseInt(event.target.value);
			if (newSize >= 2 && newSize <= 7) {
				changeCubeSize(newSize);
			}
		});

		// Cube type selector event
		cubeTypeSelect?.addEventListener('change', (event) => {
			if (state.isRotating || moveQueue.length) {
				setMessage('회전이 끝난 후 큐브 타입을 변경할 수 있습니다.');
				event.target.value = state.cubeType; // Reset to current value
				return;
			}
			
			const newType = event.target.value;
			if (newType === 'normal' || newType === 'mirror') {
				state.cubeType = newType;
				buildCube();
				resetCube();
				setMessage(newType === 'mirror' ? '미러 큐브 모드로 변경되었습니다!' : '일반 큐브 모드로 변경되었습니다!');
			}
		});

		// Back view button events
		if (backViewBtn) {
			let isBackViewButtonPressed = false;

			const activateBackView = (event) => {
				event.preventDefault();
				event.stopPropagation();
				if (!state.isBackFaceView && !isBackViewButtonPressed) {
					isBackViewButtonPressed = true;
					toggleBackFaceView();
					backViewBtn.classList.add('active');
				}
			};

			const deactivateBackView = (event) => {
				if (event) {
					event.preventDefault();
					event.stopPropagation();
				}
				if (state.isBackFaceView && isBackViewButtonPressed) {
					isBackViewButtonPressed = false;
					toggleBackFaceView();
					backViewBtn.classList.remove('active');
				}
			};

			// Mouse events on button
			backViewBtn.addEventListener('mousedown', activateBackView);
			backViewBtn.addEventListener('mouseup', deactivateBackView);
			backViewBtn.addEventListener('mouseleave', deactivateBackView);

			// Touch events on button
			backViewBtn.addEventListener('touchstart', activateBackView, { passive: false });
			backViewBtn.addEventListener('touchend', deactivateBackView, { passive: false });
			backViewBtn.addEventListener('touchcancel', deactivateBackView, { passive: false });

			// Global event listeners to handle cases where mouse/touch is released outside the button
			const handleGlobalRelease = () => {
				if (isBackViewButtonPressed) {
					deactivateBackView();
				}
			};

			window.addEventListener('mouseup', handleGlobalRelease);
			window.addEventListener('touchend', handleGlobalRelease);
			window.addEventListener('touchcancel', handleGlobalRelease);
		}
	}

	function toggleBackFaceView() {
		state.isBackFaceView = !state.isBackFaceView;
		
		cubelets.forEach((cubelet) => {
			if (Array.isArray(cubelet.mesh.material)) {
				if (state.isBackFaceView) {
					// Store original materials for restoration
					if (!cubelet.originalMaterials) {
						cubelet.originalMaterials = cubelet.mesh.material.slice();
					}
					
					// Create basic materials for pure color rendering (no lighting)
					const basicMaterials = cubelet.mesh.material.map((material) => {
						const color = material.color.getHex();
						if (color === COLORS.base) {
							// Hide interior (base color) faces
							return new THREE.MeshBasicMaterial({
								color: color,
								visible: false,
								side: THREE.BackSide
							});
						} else {
							// Show back faces with pure colors (no lighting effects)
							return new THREE.MeshBasicMaterial({
								color: color,
								side: THREE.BackSide
							});
						}
					});
					cubelet.mesh.material = basicMaterials;
				} else {
					// Restore original physically-based materials
					if (cubelet.originalMaterials) {
						// Dispose of basic materials
						cubelet.mesh.material.forEach((material) => {
							material.dispose();
						});
						
						cubelet.mesh.material = cubelet.originalMaterials;
						cubelet.originalMaterials.forEach((material) => {
							material.visible = true;
							material.side = THREE.FrontSide;
							material.needsUpdate = true;
						});
						
						// Clean up reference to prevent memory leak
						delete cubelet.originalMaterials;
					}
				}
			} else {
				if (state.isBackFaceView) {
					// Store original material for restoration
					if (!cubelet.originalMaterial) {
						cubelet.originalMaterial = cubelet.mesh.material;
					}
					
					const color = cubelet.mesh.material.color.getHex();
					if (color === COLORS.base) {
						cubelet.mesh.material = new THREE.MeshBasicMaterial({
							color: color,
							visible: false,
							side: THREE.BackSide
						});
					} else {
						cubelet.mesh.material = new THREE.MeshBasicMaterial({
							color: color,
							side: THREE.BackSide
						});
					}
				} else {
					// Restore original physically-based material
					if (cubelet.originalMaterial) {
						// Dispose of basic material
						cubelet.mesh.material.dispose();
						
						cubelet.mesh.material = cubelet.originalMaterial;
						cubelet.mesh.material.visible = true;
						cubelet.mesh.material.side = THREE.FrontSide;
						cubelet.mesh.material.needsUpdate = true;
						
						// Clean up reference to prevent memory leak
						delete cubelet.originalMaterial;
					}
				}
			}
		});
		
		setMessage(state.isBackFaceView ? '뒷면 보기 모드가 활성화되었습니다.' : '앞면 보기 모드로 변경되었습니다.');
	}

	/**
	 * Helper function to determine which cube axis is most aligned with a given vector
	 * @param {THREE.Vector3} vector - The vector to analyze
	 * @returns {{ axis: string, layer: number }} - The dominant axis name and layer (1 or -1)
	 */
	function getDominantAxisAndLayer(vector) {
		const absX = Math.abs(vector.x);
		const absY = Math.abs(vector.y);
		const absZ = Math.abs(vector.z);
		
		if (absX >= absY && absX >= absZ) {
			return { axis: 'x', layer: vector.x > 0 ? 1 : -1 };
		} else if (absY >= absX && absY >= absZ) {
			return { axis: 'y', layer: vector.y > 0 ? 1 : -1 };
		} else {
			return { axis: 'z', layer: vector.z > 0 ? 1 : -1 };
		}
	}

	/**
	 * Determines which cube face is most visible to the camera and returns
	 * a transformation matrix to map keyboard inputs to camera-relative moves.
	 */
	function getCameraRelativeFaceMapping() {
		// Get camera direction (from camera to cube center)
		const cameraDir = new THREE.Vector3();
		cameraDir.subVectors(cameraTarget, camera.position).normalize();
		
		// Get camera up and right vectors
		const cameraUp = camera.up.clone().normalize();
		const cameraRight = new THREE.Vector3().crossVectors(cameraDir, cameraUp).normalize();
		// Recalculate up to ensure orthogonality
		const cameraUpCorrected = new THREE.Vector3().crossVectors(cameraRight, cameraDir).normalize();
		
		// Map logical directions to actual cube axes based on camera view
		// The face the camera is looking at most directly becomes "Front" (F)
		// The opposite becomes "Back" (B)
		// The top of the screen becomes "Up" (U)
		// The bottom becomes "Down" (D)
		// The right side becomes "Right" (R)
		// The left side becomes "Left" (L)
		
		// Determine which cube axes are most aligned with camera directions
		const front = getDominantAxisAndLayer(cameraDir);
		const up = getDominantAxisAndLayer(cameraUpCorrected);
		const right = getDominantAxisAndLayer(cameraRight);
		
		return {
			F: { axis: front.axis, layer: front.layer },      // Front (face camera is looking at)
			B: { axis: front.axis, layer: -front.layer },     // Back (opposite of front)
			U: { axis: up.axis, layer: up.layer },            // Up (top of screen)
			D: { axis: up.axis, layer: -up.layer },           // Down (bottom of screen)
			R: { axis: right.axis, layer: right.layer },      // Right (right side of screen)
			L: { axis: right.axis, layer: -right.layer }      // Left (left side of screen)
		};
	}

	function bindKeyboardShortcuts() {
		// Build key map from settings (logical mapping for camera-relative mode)
		const logicalKeyMap = {};
		logicalKeyMap[keyboardSettings.U] = 'U';
		logicalKeyMap[keyboardSettings.D] = 'D';
		logicalKeyMap[keyboardSettings.L] = 'L';
		logicalKeyMap[keyboardSettings.R] = 'R';
		logicalKeyMap[keyboardSettings.F] = 'F';
		logicalKeyMap[keyboardSettings.B] = 'B';

		// Fixed-axis mapping (original mode)
		const fixedAxisKeyMap = {};
		fixedAxisKeyMap[keyboardSettings.U] = { axis: 'y', layer: 1 };
		fixedAxisKeyMap[keyboardSettings.D] = { axis: 'y', layer: -1 };
		fixedAxisKeyMap[keyboardSettings.L] = { axis: 'x', layer: -1 };
		fixedAxisKeyMap[keyboardSettings.R] = { axis: 'x', layer: 1 };
		fixedAxisKeyMap[keyboardSettings.F] = { axis: 'z', layer: 1 };
		fixedAxisKeyMap[keyboardSettings.B] = { axis: 'z', layer: -1 };

		window.addEventListener('keydown', (event) => {
			if (event.repeat) {
				return;
			}

			if (event.code === 'Space') {
				highlightMessage();
				return;
			}

			if (event.code === 'Escape') {
				event.preventDefault();
				toggleFocusMode();
				return;
			}

			// Check for back face view toggle
			if (event.code === keyboardSettings.toggleTransparency) {
				event.preventDefault();
				toggleBackFaceView();
				return;
			}

			let mapped;
			let logicalFace;
			
			if (keyboardSettings.cameraRelativeMode) {
				// Camera-relative mode: map based on camera orientation
				logicalFace = logicalKeyMap[event.code];
				if (!logicalFace) {
					return;
				}

				event.preventDefault();
				if (state.isRotating) {
					return;
				}

				const faceMapping = getCameraRelativeFaceMapping();
				mapped = faceMapping[logicalFace];
			} else {
				// Fixed-axis mode: use original fixed mapping
				mapped = fixedAxisKeyMap[event.code];
				if (!mapped) {
					return;
				}

				event.preventDefault();
				if (state.isRotating) {
					return;
				}
			}

			// Calculate direction
			let direction = event.shiftKey ? -1 : 1;
			
			// In camera-relative mode, adjust direction for more intuitive rotations
			// R (right): rotate right-to-left (away from camera on right side)
			// L (left): rotate left-to-right (toward camera on left side)  
			// U (up): rotate top-to-bottom (away from camera on top)
			// D (down): rotate bottom-to-top (toward camera on bottom)
			if (keyboardSettings.cameraRelativeMode && logicalFace) {
				if (logicalFace === 'R' || logicalFace === 'U') {
					// Invert direction for right and up faces for natural camera-relative rotation
					direction = -direction;
				}
			}
			
			enqueueMove({
				axis: mapped.axis,
				layer: mapped.layer,
				direction
			});
		});
	}

	function highlightMessage() {
		messageEl.classList.remove('flash');
		void messageEl.offsetWidth;
		messageEl.classList.add('flash');
	}

	function bindPointerEvents() {
		const canvas = renderer.domElement;
		canvas.addEventListener('pointerdown', onPointerDown);
		canvas.addEventListener('pointermove', onPointerMove);
		canvas.addEventListener('pointerup', onPointerUp);
		canvas.addEventListener('pointercancel', onPointerUp);
		canvas.addEventListener('wheel', onWheel, { passive: false });
		canvas.addEventListener('contextmenu', (e) => e.preventDefault());
	}

	function onPointerDown(event) {
		const canvas = renderer.domElement;
		canvas.setPointerCapture(event.pointerId);

		const pointer = createPointerState(event);
		pointerStates.set(event.pointerId, pointer);

		if (event.pointerType === 'touch') {
			event.preventDefault();
		}

		if (pointerStates.size === 1) {
			// Single pointer: determine whether to rotate cube or orbit camera.
			const intersection = pickCubeFace(pointer.clientX, pointer.clientY);
			if (intersection && !state.isRotating && !moveQueue.length) {
				dragState = {
					pointerId: event.pointerId,
					startClient: new THREE.Vector2(pointer.clientX, pointer.clientY),
					currentClient: new THREE.Vector2(pointer.clientX, pointer.clientY),
					intersection,
					hasTriggered: false
				};
			} else {
				startOrbit(event.pointerId, pointer.clientX, pointer.clientY);
			}
		} else if (pointerStates.size === 2) {
			dragState = null;
			orbitState.pointerId = null;
			startGesture();
		}
	}

	function onPointerMove(event) {
		const pointer = pointerStates.get(event.pointerId);
		if (!pointer) {
			return;
		}

		pointer.currentX = event.clientX;
		pointer.currentY = event.clientY;

		if (gestureState) {
			updateGesture();
			return;
		}

		if (dragState && dragState.pointerId === event.pointerId) {
			dragState.currentClient.set(event.clientX, event.clientY);
			handleDragMove();
			return;
		}

		if (orbitState.pointerId === event.pointerId) {
			updateOrbit(event.clientX, event.clientY);
		}
	}

	function onPointerUp(event) {
		renderer.domElement.releasePointerCapture(event.pointerId);
		pointerStates.delete(event.pointerId);

		if (dragState && dragState.pointerId === event.pointerId) {
			dragState = null;
		}

		if (orbitState.pointerId === event.pointerId) {
			orbitState.pointerId = null;
		}

		if (gestureState && gestureState.pointerIds.includes(event.pointerId)) {
			gestureState = null;
		}

		if (pointerStates.size === 1 && !gestureState) {
			const remainingId = pointerStates.keys().next().value;
			const pointer = pointerStates.get(remainingId);
			startOrbit(remainingId, pointer.currentX, pointer.currentY);
		}
	}

	function onWheel(event) {
		event.preventDefault();
		const delta = event.deltaY;
		const zoomFactor = Math.exp(delta * 0.0015);
		cameraDistance = THREE.MathUtils.clamp(
			cameraDistance * zoomFactor,
			cameraLimits.minDistance,
			cameraLimits.maxDistance
		);
		updateCameraPosition();
	}

	function normalizeAngle(angle) {
		// Normalize angle to [0, 2π] to prevent overflow
		return ((angle % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
	}

	function createPointerState(event) {
		return {
			pointerId: event.pointerId,
			pointerType: event.pointerType,
			clientX: event.clientX,
			clientY: event.clientY,
			currentX: event.clientX,
			currentY: event.clientY
		};
	}

	function startOrbit(pointerId, clientX, clientY) {
		orbitState.pointerId = pointerId;
		orbitState.startTheta = orbitState.theta;
		orbitState.startPhi = orbitState.phi;
		orbitState.startPos = new THREE.Vector2(clientX, clientY);
		
		// Capture camera orientation at drag start for consistent rotation interpretation
		// Calculate camera's right and up vectors relative to the view direction
		const viewDir = new THREE.Vector3();
		camera.getWorldDirection(viewDir);
		const cameraRight = new THREE.Vector3();
		cameraRight.crossVectors(camera.up, viewDir).normalize();
		const cameraUp = camera.up.clone().normalize();
		
		// Store these for use during drag
		orbitState.startCameraRight = cameraRight;
		orbitState.startCameraUp = cameraUp;
	}

	function updateOrbit(clientX, clientY) {
		if (!orbitState.startPos) {
			return;
		}

		const deltaX = (clientX - orbitState.startPos.x) * 0.005;
		const deltaY = (clientY - orbitState.startPos.y) * 0.005;

		orbitState.theta = normalizeAngle(orbitState.startTheta - deltaX);
		orbitState.phi = THREE.MathUtils.clamp(
			orbitState.startPhi - deltaY,
			cameraLimits.minPhi,
			cameraLimits.maxPhi
		);

		updateCameraPosition();
	}

	function startGesture() {
		const ids = Array.from(pointerStates.keys());
		if (ids.length !== 2) {
			return;
		}

		const p1 = pointerStates.get(ids[0]);
		const p2 = pointerStates.get(ids[1]);
		const midpoint = midpointOfPointers(p1, p2);

		gestureState = {
			pointerIds: ids,
			lastMidpoint: midpoint,
			lastDistance: distanceBetweenPointers(p1, p2),
			lastAngle: angleBetweenPointers(p1, p2)
		};
	}

	function updateGesture() {
		if (!gestureState) {
			return;
		}

		const p1 = pointerStates.get(gestureState.pointerIds[0]);
		const p2 = pointerStates.get(gestureState.pointerIds[1]);
		if (!p1 || !p2) {
			gestureState = null;
			return;
		}

		const midpoint = midpointOfPointers(p1, p2);
		const distance = distanceBetweenPointers(p1, p2);
		const angle = angleBetweenPointers(p1, p2);

		gestureState.lastMidpoint.copy(midpoint);

		if (distance > 0 && gestureState.lastDistance > 0) {
			const scale = distance / gestureState.lastDistance;
			cameraDistance = THREE.MathUtils.clamp(
				cameraDistance / scale,
				cameraLimits.minDistance,
				cameraLimits.maxDistance
			);
			updateCameraPosition();
		}

		gestureState.lastDistance = distance;

		// Handle rotation gesture
		if (gestureState.lastAngle !== undefined) {
			let angleDelta = angle - gestureState.lastAngle;
			
			// Normalize angle difference to [-PI, PI]
			while (angleDelta > Math.PI) angleDelta -= 2 * Math.PI;
			while (angleDelta < -Math.PI) angleDelta += 2 * Math.PI;
			
			// Only rotate if the angle change is significant enough to avoid jitter
			if (Math.abs(angleDelta) > 0.01) {
				// Rotate camera around the viewing axis (theta rotation)
				orbitState.theta = normalizeAngle(orbitState.theta + angleDelta);
				updateCameraPosition();
			}
		}
		
		gestureState.lastAngle = angle;
	}

	function handleDragMove() {
		if (!dragState || dragState.hasTriggered) {
			return;
		}

		const dragVec = dragState.currentClient.clone().sub(dragState.startClient);
		if (dragVec.length() < 8) {
			return;
		}

		const move = determineMoveFromDrag(dragState, dragVec);
		if (!move) {
			return;
		}

		dragState.hasTriggered = true;
		dragState = null;
		enqueueMove(move);
	}

	function determineMoveFromDrag(stateObj, dragVec) {
		const { intersection } = stateObj;
		const { cubelet, point, normal } = intersection;

		// Calculate two orthogonal tangent vectors on the clicked face
		// These represent the two possible drag directions on the face
		let tangentA = new THREE.Vector3(0, 1, 0);
		if (Math.abs(tangentA.dot(normal)) > 0.9) {
			tangentA.set(1, 0, 0);
		}
		tangentA.cross(normal).normalize();
		const tangentB = new THREE.Vector3().crossVectors(normal, tangentA).normalize();

		// Project both tangent directions to screen space to see which matches the drag
		const projectionA = projectDirectionToScreen(point, tangentA);
		const projectionB = projectDirectionToScreen(point, tangentB);

		const dragLength = dragVec.length();
		if (dragLength === 0) {
			return null;
		}

		// Calculate alignment scores for both tangent directions
		const scoreA = projectionA.dot(dragVec) / (projectionA.length() * dragLength || 1);
		const scoreB = projectionB.dot(dragVec) / (projectionB.length() * dragLength || 1);

		// Choose the tangent direction that best aligns with the drag
		let dragTangent3D;
		let rotationAxis3D;
		
		if (Math.abs(scoreA) >= Math.abs(scoreB)) {
			// Drag is primarily along tangentA
			dragTangent3D = tangentA.clone().multiplyScalar(Math.sign(scoreA));
			// Rotation axis is perpendicular to both normal and dragTangent
			// This is tangentB (or -tangentB depending on orientation)
			rotationAxis3D = new THREE.Vector3().crossVectors(normal, dragTangent3D).normalize();
		} else {
			// Drag is primarily along tangentB
			dragTangent3D = tangentB.clone().multiplyScalar(Math.sign(scoreB));
			// Rotation axis is perpendicular to both normal and dragTangent
			rotationAxis3D = new THREE.Vector3().crossVectors(normal, dragTangent3D).normalize();
		}

		// Determine which of the three cube axes (x, y, z) best matches the rotation axis
		const absX = Math.abs(rotationAxis3D.x);
		const absY = Math.abs(rotationAxis3D.y);
		const absZ = Math.abs(rotationAxis3D.z);

		let rotationAxisName;
		let rotationLayer;
		
		// Helper to get the layer from position (handles both even and odd cubes)
		const getLayer = (value) => {
			const isEven = state.cubeSize % 2 === 0;
			if (isEven) {
				// For even cubes, snap to nearest 0.5 increment
				return Math.round(value * 2) / 2;
			} else {
				// For odd cubes, snap to integers
				return Math.round(value);
			}
		};

		if (absX >= absY && absX >= absZ) {
			rotationAxisName = 'x';
			// Layer is determined by the cubelet's position on this axis
			rotationLayer = getLayer(cubelet.logicalPosition.x);
		} else if (absY >= absX && absY >= absZ) {
			rotationAxisName = 'y';
			rotationLayer = getLayer(cubelet.logicalPosition.y);
		} else {
			rotationAxisName = 'z';
			rotationLayer = getLayer(cubelet.logicalPosition.z);
		}

		// Determine the rotation direction by testing which way matches the drag best
		const rotationAxisVector = AXIS_VECTORS[rotationAxisName];
		const samplePoint = point.clone().add(dragTangent3D.clone().multiplyScalar(0.35));
		const baseAngle = Math.PI / 2;
		const screenStart = projectPointToScreen(samplePoint);

		let bestSign = null;
		let bestScore = -Infinity;
		const normalizedDrag = dragVec.clone().normalize();

		// Test both rotation directions to see which one makes the point follow the drag
		for (const sign of [1, -1]) {
			const rotatedPoint = rotatePointAroundAxis(samplePoint, rotationAxisVector, sign * baseAngle);
			const rotatedScreen = projectPointToScreen(rotatedPoint);
			const predicted = rotatedScreen.sub(screenStart);
			if (predicted.lengthSq() === 0) {
				continue;
			}
			predicted.normalize();
			const score = predicted.dot(normalizedDrag);
			if (score > bestScore) {
				bestScore = score;
				bestSign = sign;
			}
		}

		if (bestSign === null) {
			bestSign = 1;
		}

		// Convert the rotation sign to the final direction
		const direction = deriveDirectionFromAngleSign(bestSign, rotationLayer);

		return {
			axis: rotationAxisName,
			layer: rotationLayer,
			direction
		};
	}

	function dominantAxisFromNormal(normal) {
		const ax = Math.abs(normal.x);
		const ay = Math.abs(normal.y);
		const az = Math.abs(normal.z);

		if (ax >= ay && ax >= az) {
			return 'x';
		}
		if (ay >= ax && ay >= az) {
			return 'y';
		}
		return 'z';
	}

	function deriveDirectionFromAngleSign(angleSign, layer) {
		if (layer === 0) {
			// Middle layer: reverse the rotation direction
			return angleSign > 0 ? -1 : 1;
		}
		const viewAlignment = layer === 1 ? 1 : -1;
		let direction = -angleSign / viewAlignment;
		if (direction > 0) {
			return 1;
		}
		if (direction < 0) {
			return -1;
		}
		return 1;
	}

	function projectDirectionToScreen(origin, direction) {
		const target = origin.clone().add(direction);
		const start2D = projectPointToScreen(origin.clone());
		const end2D = projectPointToScreen(target);
		return end2D.sub(start2D);
	}

	function projectPointToScreen(point) {
		const projected = point.clone().project(camera);
		const rect = renderer.domElement.getBoundingClientRect();
		return new THREE.Vector2(
			(projected.x * 0.5 + 0.5) * rect.width,
			(-projected.y * 0.5 + 0.5) * rect.height
		);
	}

	function rotatePointAroundAxis(point, axisVector, angle) {
		const quaternion = tmpQuat.setFromAxisAngle(axisVector, angle);
		return point.clone().applyQuaternion(quaternion);
	}

	function pickCubeFace(clientX, clientY) {
		const ndc = clientToNdc(clientX, clientY);
		raycaster.setFromCamera(ndc, camera);
		// Raycast against picking helpers (invisible, larger boxes) instead of visible meshes
		// This allows users to drag near edges without missing the cube
		const pickingHelpers = cubelets.map((c) => c.pickingHelper);
		const intersects = raycaster.intersectObjects(pickingHelpers);
		if (!intersects.length) {
			return null;
		}

		const hit = intersects[0];
		const cubelet = hit.object.userData.cubelet;
		if (!cubelet) {
			return null;
		}

		const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
		const normal = hit.face.normal.clone().applyMatrix3(normalMatrix).normalize();

		return {
			cubelet,
			point: hit.point.clone(),
			normal
		};
	}

	function clientToNdc(clientX, clientY) {
		const rect = renderer.domElement.getBoundingClientRect();
		return new THREE.Vector2(
			((clientX - rect.left) / rect.width) * 2 - 1,
			-((clientY - rect.top) / rect.height) * 2 + 1
		);
	}

	function enqueueMove(move) {
		const normalized = normalizeMove(move);
		moveQueue.push(normalized);
		if (!state.isRotating) {
			processMoveQueue();
		}
	}

	function normalizeMove(move) {
		const axis = move.axis;
		const layer = move.layer;  // Allow any layer based on cube size
		const direction = move.direction === -1 ? -1 : 1;
		const angle = computeActualAngle(axis, layer, direction);
		const halfSize = scene.userData.halfSize || 1;
		
		// Generate notation for the move
		let notation = move.notation;
		if (!notation) {
			// For outer layers, use standard face notation
			if (layer === halfSize || layer === -halfSize) {
				notation = FACE_NOTATION[axis]?.[layer > 0 ? 1 : -1];
			} else if (layer === 0 && state.cubeSize % 2 === 1) {
				// Middle layer notation for odd-sized cubes
				const middleLayerNotation = axis === 'x' ? 'M' : (axis === 'y' ? 'E' : 'S');
				notation = middleLayerNotation;
			} else {
				// Inner layers - use a simple notation
				notation = `${axis.toUpperCase()}${layer}`;
			}
			notation += direction === 1 ? '' : "'";
		}
		const duration = move.duration ?? state.rotationSpeed;

		return {
			axis,
			layer,
			direction,
			angle,
			notation,
			duration,
			record: move.record !== false,
			onComplete: move.onComplete || null
		};
	}

	function processMoveQueue() {
		if (!moveQueue.length) {
			return;
		}

		const move = moveQueue.shift();
		// For even-sized cubes, positions can be fractional (e.g., 0.5, 1.5)
		// We need to compare with a small tolerance instead of using Math.round()
		const layerCubelets = cubelets.filter((cubelet) => {
			const pos = cubelet.logicalPosition[move.axis];
			return Math.abs(pos - move.layer) < POSITION_TOLERANCE;
		});
		const axisVector = AXIS_VECTORS[move.axis].clone();
		const rotationMatrix4 = tmpMatrix4.makeRotationAxis(axisVector, move.angle);
		const rotationMatrix3 = tmpMatrix3.setFromMatrix4(rotationMatrix4);

		state.isRotating = true;
		animateLayerRotation(layerCubelets, axisVector, move.angle, move.duration, () => {
			finalizeLayer(layerCubelets, rotationMatrix3);
			if (move.record) {
				recordMove(move);
			}
			move.onComplete?.(move);
			state.isRotating = false;
			if (moveQueue.length) {
				processMoveQueue();
			}
		});
	}

	function computeActualAngle(axis, layer, direction) {
		const base = Math.PI / 2;
		const halfSize = scene.userData.halfSize || 1;
		
		if (layer === 0 && state.cubeSize % 2 === 1) {
			// Middle layer (only for odd-sized cubes): use consistent direction mapping
			return -direction * base;
		}
		
		// Determine the view alignment based on whether we're on the positive or negative side
		const viewAlignment = layer > 0 ? 1 : -1;
		return -direction * viewAlignment * base;
	}

	function animateLayerRotation(cubeletGroup, axisVector, targetAngle, duration, onDone) {
		const start = performance.now();
		let previousAngle = 0;

		// Temporarily enhance the rotating cubelets' appearance
		cubeletGroup.forEach((cubelet) => {
			if (Array.isArray(cubelet.mesh.material)) {
				cubelet.mesh.material.forEach((material) => {
					if (material.emissive && material.emissive.getHex() !== 0x000000) {
						material.userData = material.userData || {};
						material.userData.originalEmissiveIntensity = material.emissiveIntensity;
						material.emissiveIntensity = 0.25; // Brighter during rotation
					}
				});
			}
		});

		function step(now) {
			const elapsed = now - start;
			const t = Math.min(elapsed / duration, 1);
			const eased = easeOutCubic(t);
			const currentAngle = targetAngle * eased;
			const delta = currentAngle - previousAngle;

			cubeletGroup.forEach((cubelet) => {
				cubelet.mesh.position.applyAxisAngle(axisVector, delta);
				cubelet.mesh.rotateOnWorldAxis(axisVector, delta);
			});

			previousAngle = currentAngle;
			if (t < 1) {
				requestAnimationFrame(step);
			} else {
				// Reset emissive intensity after rotation
				cubeletGroup.forEach((cubelet) => {
					if (Array.isArray(cubelet.mesh.material)) {
						cubelet.mesh.material.forEach((material) => {
							if (material.userData && material.userData.originalEmissiveIntensity !== undefined) {
								material.emissiveIntensity = material.userData.originalEmissiveIntensity;
							}
						});
					}
				});
				onDone();
			}
		}

		requestAnimationFrame(step);
	}

	function finalizeLayer(cubeletGroup, rotationMatrix3) {
		const spacing = scene.userData.spacing;
		const cubeletSize = scene.userData.cubeletSize || 0.92;
		const halfSize = scene.userData.halfSize || 1;
		const isMirrorMode = state.cubeType === 'mirror';
		const isEven = state.cubeSize % 2 === 0;
		
		// Helper function to snap to correct grid positions
		const snapToGrid = (value) => {
			if (isEven) {
				// For even cubes, snap to nearest 0.5 increment (e.g., -1.5, -0.5, 0.5, 1.5)
				return Math.round(value * 2) / 2;
			} else {
				// For odd cubes, snap to integers (e.g., -2, -1, 0, 1, 2)
				return Math.round(value);
			}
		};

		cubeletGroup.forEach((cubelet) => {
			cubelet.logicalPosition.applyMatrix3(rotationMatrix3);
			cubelet.logicalPosition.set(
				snapToGrid(cubelet.logicalPosition.x),
				snapToGrid(cubelet.logicalPosition.y),
				snapToGrid(cubelet.logicalPosition.z)
			);

			cubelet.orientation.x.applyMatrix3(rotationMatrix3);
			cubelet.orientation.y.applyMatrix3(rotationMatrix3);
			cubelet.orientation.z.applyMatrix3(rotationMatrix3);

			cubelet.orientation.x.set(
				Math.round(cubelet.orientation.x.x),
				Math.round(cubelet.orientation.x.y),
				Math.round(cubelet.orientation.x.z)
			);
			cubelet.orientation.y.set(
				Math.round(cubelet.orientation.y.x),
				Math.round(cubelet.orientation.y.y),
				Math.round(cubelet.orientation.y.z)
			);
			cubelet.orientation.z.set(
				Math.round(cubelet.orientation.z.x),
				Math.round(cubelet.orientation.z.y),
				Math.round(cubelet.orientation.z.z)
			);

			// In mirror mode, pieces should NOT move to different physical positions after rotation
			// They should rotate in place, maintaining their current physical position
			// Only in normal mode should we recalculate physical positions based on logical positions
			if (!isMirrorMode) {
				const posX = cubelet.logicalPosition.x * spacing;
				const posY = cubelet.logicalPosition.y * spacing;
				const posZ = cubelet.logicalPosition.z * spacing;
				cubelet.mesh.position.set(posX, posY, posZ);
			}
			// In mirror mode: position stays as-is (pieces rotate in place)

			const basisMatrix = new THREE.Matrix4().makeBasis(
				cubelet.orientation.x,
				cubelet.orientation.y,
				cubelet.orientation.z
			);
			cubelet.mesh.quaternion.setFromRotationMatrix(basisMatrix);
		});
	}

	function recordMove(move) {
		state.moveHistory.push({
			axis: move.axis,
			layer: move.layer,
			direction: move.direction,
			notation: move.notation
		});
		state.moveCount += 1;
		
		// Start game timer on first move
		if (!state.gameInProgress && state.moveCount === 1) {
			state.gameInProgress = true;
			state.gameStartTime = Date.now();
		}
		
		updateHud(move.notation);
		if (isCubeSolved()) {
			handleVictory();
		} else {
			setMessage(`${move.notation} 수행!`);
		}
	}

	function updateHud(notation) {
		moveCountEl.textContent = String(state.moveCount);
		if (notation) {
			moveLogEl.textContent = notation;
		} else if (state.moveHistory.length) {
			moveLogEl.textContent = state.moveHistory[state.moveHistory.length - 1].notation;
		} else {
			moveLogEl.textContent = '-';
		}
	}

	function isCubeSolved() {
		return cubelets.every((cubelet) => {
			if (!cubelet.logicalPosition.equals(cubelet.initialLogicalPosition)) {
				return false;
			}
			const basisMatrix = new THREE.Matrix4().makeBasis(
				cubelet.orientation.x,
				cubelet.orientation.y,
				cubelet.orientation.z
			);
			const initialBasis = new THREE.Matrix4().makeBasis(
				cubelet.initialOrientation.x,
				cubelet.initialOrientation.y,
				cubelet.initialOrientation.z
			);
			return basisMatrix.equals(initialBasis);
		});
	}

	function handleVictory() {
		state.gameInProgress = false;
		// Handle case where game timer wasn't started (edge case)
		const gameTimeMs = state.gameStartTime ? (Date.now() - state.gameStartTime) : 0;
		state.lastGameTime = gameTimeMs;
		
		setMessage('축하합니다! 큐브를 완성했습니다!', { celebrate: true });
		
		// Add victory animation - make cube pulse and glow
		celebrateCube();
		
		// Open victory modal after a short delay
		setTimeout(() => {
			openVictoryModal(state.moveCount, gameTimeMs);
		}, 800);
	}

	function celebrateCube() {
		// Enhance emissive intensity for celebration effect
		const duration = 2000;
		const startTime = performance.now();
		
		function animateCelebration(now) {
			const elapsed = now - startTime;
			const t = elapsed / duration;
			
			if (t < 1) {
				// Pulse effect - oscillate emissive intensity
				const pulseIntensity = 0.3 + 0.3 * Math.sin(t * Math.PI * 6);
				
				cubelets.forEach((cubelet) => {
					if (Array.isArray(cubelet.mesh.material)) {
						cubelet.mesh.material.forEach((material) => {
							if (material.emissive && material.emissive.getHex() !== 0x000000) {
								material.emissiveIntensity = pulseIntensity;
							}
						});
					}
				});
				
				requestAnimationFrame(animateCelebration);
			} else {
				// Reset to normal emissive intensity
				cubelets.forEach((cubelet) => {
					if (Array.isArray(cubelet.mesh.material)) {
						cubelet.mesh.material.forEach((material) => {
							if (material.emissive && material.emissive.getHex() !== 0x000000) {
								material.emissiveIntensity = 0.1;
							}
						});
					}
				});
			}
		}
		
		requestAnimationFrame(animateCelebration);
	}

	function scrambleCube() {
		const n = state.cubeSize;
		const halfSize = (n - 1) / 2;
		const scrambleLength = Math.max(20, n * 8); // More scrambles for larger cubes
		const moves = [];
		const options = [];
		
		// Generate all possible layer options based on cube size
		const axes = ['x', 'y', 'z'];
		for (const axis of axes) {
			// Always use step of 1 to match how cubelets are created
			for (let layer = -halfSize; layer <= halfSize; layer += 1) {
				options.push({ axis, layer });
			}
		}

		let lastOption = null;
		for (let i = 0; i < scrambleLength; i += 1) {
			let candidate;
			do {
				candidate = options[Math.floor(Math.random() * options.length)];
			} while (lastOption && candidate.axis === lastOption.axis && candidate.layer === lastOption.layer);

			lastOption = candidate;
			moves.push({
				axis: candidate.axis,
				layer: candidate.layer,
				direction: Math.random() > 0.5 ? 1 : -1,
				record: false,
				duration: 50
			});
		}

		if (!moves.length) {
			return;
		}

		state.moveHistory.length = 0;
		state.moveCount = 0;
		state.gameInProgress = false;
		state.gameStartTime = null;
		updateHud();
		setMessage('큐브를 섞는 중...');

		const finalMoveIndex = moves.length - 1;
		moves.forEach((move, idx) => {
			enqueueMove({
				...move,
				onComplete: idx === finalMoveIndex ? () => {
					setMessage('섞기가 완료되었습니다! 즐겁게 플레이하세요.');
				} : null
			});
		});
	}

	function setMessage(text, options = {}) {
		state.latestMessage = text;
		messageEl.textContent = text;
		if (options.celebrate) {
			messageEl.classList.add('celebrate');
		} else {
			messageEl.classList.remove('celebrate');
		}
	}

	function animate() {
		requestAnimationFrame(animate);
		renderer.render(scene, camera);
		updateGameTimer();
	}

	function formatLiveTime(timeInMilliseconds) {
		const totalSeconds = Math.floor(timeInMilliseconds / 1000);
		const mins = Math.floor(totalSeconds / 60);
		const secs = totalSeconds % 60;
		const cs = Math.floor((timeInMilliseconds % 1000) / 10); // centiseconds
		
		// If under 60 seconds, show only seconds
		if (totalSeconds < 60) {
			return `${secs.toString().padStart(2, '0')}:${cs.toString().padStart(2, '0')}`;
		}
		
		// Otherwise show minutes:seconds:centiseconds
		return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${cs.toString().padStart(2, '0')}`;
	}

	function updateGameTimer() {
		if (!gameTimerEl) return;
		
		if (state.gameInProgress && state.gameStartTime) {
			const elapsedTime = Date.now() - state.gameStartTime;
			gameTimerEl.textContent = formatLiveTime(elapsedTime);
			gameTimerEl.style.display = 'block';
		} else {
			gameTimerEl.style.display = 'none';
		}
	}

	function easeOutCubic(t) {
		return 1 - Math.pow(1 - t, 3);
	}

	function updateCameraPosition() {
		const sinPhi = Math.sin(orbitState.phi);
		const cosPhi = Math.cos(orbitState.phi);
		const sinTheta = Math.sin(orbitState.theta);
		const cosTheta = Math.cos(orbitState.theta);

		camera.position.set(
			cameraTarget.x + cameraDistance * sinPhi * sinTheta,
			cameraTarget.y + cameraDistance * cosPhi,
			cameraTarget.z + cameraDistance * sinPhi * cosTheta
		);
		camera.lookAt(cameraTarget);
	}

	function distanceBetweenPointers(p1, p2) {
		return Math.hypot(p1.currentX - p2.currentX, p1.currentY - p2.currentY);
	}

	function midpointOfPointers(p1, p2) {
		return new THREE.Vector2(
			(p1.currentX + p2.currentX) * 0.5,
			(p1.currentY + p2.currentY) * 0.5
		);
	}

	function angleBetweenPointers(p1, p2) {
		return Math.atan2(p2.currentY - p1.currentY, p2.currentX - p1.currentX);
	}

	function onResize() {
		const rect = stageEl.getBoundingClientRect();
		const width = rect.width || stageEl.clientWidth || 1;
		const height = rect.height || stageEl.clientHeight || 1;
		renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
		renderer.setSize(width, height, false);
		camera.aspect = width / height;
		camera.updateProjectionMatrix();
	}

	function toggleFocusMode() {
		document.body.classList.toggle('focus-mode');
		const isFocusMode = document.body.classList.contains('focus-mode');
		
		if (focusBtn) {
			if (isFocusMode) {
				// Entering focus mode
				focusBtn.textContent = '집중 모드 종료';
				// Request fullscreen
				enterFullscreen();
			} else {
				// Exiting focus mode
				focusBtn.textContent = '집중 모드';
				// Exit fullscreen
				exitFullscreen();
			}
		}
		
		// Trigger resize to adjust canvas
		setTimeout(() => {
			onResize();
		}, 100);
	}

	function enterFullscreen() {
		const elem = document.documentElement;
		if (elem.requestFullscreen) {
			elem.requestFullscreen().catch(err => {
				console.error('Failed to enter fullscreen mode:', err);
			});
		} else if (elem.webkitRequestFullscreen) { // Safari
			elem.webkitRequestFullscreen();
		} else if (elem.msRequestFullscreen) { // IE11
			elem.msRequestFullscreen();
		}
	}

	function exitFullscreen() {
		if (document.exitFullscreen) {
			document.exitFullscreen().catch(err => {
				console.error('Failed to exit fullscreen mode:', err);
			});
		} else if (document.webkitExitFullscreen) { // Safari
			document.webkitExitFullscreen();
		} else if (document.msExitFullscreen) { // IE11
			document.msExitFullscreen();
		}
	}

	// ===== Leaderboard Functions =====
	
	async function loadLeaderboard() {
		if (!window.firebaseDb) {
			leaderboardStatus.textContent = 'Firebase 연결 대기 중...';
			leaderboardStatus.classList.add('error');
			return;
		}

		try {
			leaderboardStatus.textContent = '순위표 불러오는 중...';
			leaderboardStatus.classList.remove('error');
			
			const { collection, query, orderBy, limit, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
			
			const scoresRef = collection(window.firebaseDb, 'scores');
			const q = query(scoresRef, orderBy('moves', 'asc'), orderBy('time', 'asc'), limit(10));
			const querySnapshot = await getDocs(q);
			
			leaderboardList.innerHTML = '';
			
			if (querySnapshot.empty) {
				leaderboardList.innerHTML = '<p style="text-align: center; opacity: 0.7; padding: 1rem;">아직 등록된 기록이 없습니다. 첫 번째 기록을 세워보세요!</p>';
				leaderboardStatus.textContent = '기록이 없습니다.';
			} else {
				let rank = 1;
				querySnapshot.forEach((doc) => {
					const data = doc.data();
					const entry = createLeaderboardEntry(rank, data.nickname, data.moves, data.time);
					leaderboardList.appendChild(entry);
					rank++;
				});
				leaderboardStatus.textContent = `${querySnapshot.size}개의 기록을 불러왔습니다.`;
			}
		} catch (error) {
			console.error('Failed to load leaderboard:', error);
			leaderboardStatus.textContent = '순위표를 불러오는데 실패했습니다. (데모 모드)';
			leaderboardStatus.classList.add('error');
			
			// Show demo data
			showDemoLeaderboard();
		}
	}

	function showDemoLeaderboard() {
		leaderboardList.innerHTML = '';
		const demoData = [
			{ nickname: '큐브마스터', moves: 45, time: 123000 },
			{ nickname: '퍼즐왕', moves: 52, time: 156000 },
			{ nickname: '스피드큐버', moves: 58, time: 98000 },
			{ nickname: 'CubeNinja', moves: 61, time: 145000 },
			{ nickname: '3D전문가', moves: 67, time: 178000 }
		];
		
		demoData.forEach((data, index) => {
			const entry = createLeaderboardEntry(index + 1, data.nickname, data.moves, data.time);
			leaderboardList.appendChild(entry);
		});
	}

	function createLeaderboardEntry(rank, nickname, moves, timeInMilliseconds) {
		const entry = document.createElement('div');
		entry.className = `leaderboard-entry rank-${rank}`;
		
		const rankEl = document.createElement('div');
		rankEl.className = 'leaderboard-rank';
		rankEl.textContent = rank;
		
		const nameEl = document.createElement('div');
		nameEl.className = 'leaderboard-name';
		nameEl.textContent = nickname;
		
		const movesEl = document.createElement('div');
		movesEl.className = 'leaderboard-moves';
		movesEl.textContent = `${moves}회`;
		
		const timeEl = document.createElement('div');
		timeEl.className = 'leaderboard-time';
		timeEl.textContent = formatTime(timeInMilliseconds);
		
		entry.appendChild(rankEl);
		entry.appendChild(nameEl);
		entry.appendChild(movesEl);
		entry.appendChild(timeEl);
		
		return entry;
	}

	function formatTime(timeInMilliseconds) {
		const totalSeconds = Math.floor(timeInMilliseconds / 1000);
		const mins = Math.floor(totalSeconds / 60);
		const secs = totalSeconds % 60;
		const ms = Math.floor((timeInMilliseconds % 1000) / 10); // Get centiseconds (0-99)
		return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${ms.toString().padStart(2, '0')}`;
	}

	function openVictoryModal(moves, timeInMilliseconds) {
		victoryMoveCount.textContent = moves;
		victoryTime.textContent = formatTime(timeInMilliseconds);
		
		// Load saved nickname if available
		const savedNickname = localStorage.getItem('cubeGameNickname') || '';
		nicknameInput.value = savedNickname;
		
		victoryModal.style.display = 'flex';
	}

	function closeVictoryModal() {
		victoryModal.style.display = 'none';
	}

	async function saveScore() {
		const nickname = nicknameInput.value.trim();
		
		if (!nickname) {
			alert('닉네임을 입력해주세요!');
			nicknameInput.focus();
			return;
		}
		
		// Save nickname for future use
		localStorage.setItem('cubeGameNickname', nickname);
		
		// Use the stored game time from when victory was achieved
		const gameTime = state.lastGameTime;
		
		if (!window.firebaseDb) {
			setMessage('Firebase에 연결할 수 없습니다. (데모 모드)');
			closeVictoryModal();
			return;
		}

		try {
			const { collection, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
			
			await addDoc(collection(window.firebaseDb, 'scores'), {
				nickname: nickname,
				moves: state.moveCount,
				time: gameTime,
				timestamp: serverTimestamp()
			});
			
			setMessage(`${nickname}님의 기록이 순위표에 등록되었습니다!`);
			closeVictoryModal();
			
			// Refresh leaderboard
			setTimeout(() => loadLeaderboard(), 500);
		} catch (error) {
			console.error('Failed to save score:', error);
			setMessage('기록 저장에 실패했습니다. (데모 모드)');
			closeVictoryModal();
		}
	}

	// Bind victory modal events
	// Note: Close button (X) is disabled - users must click "Skip" or "Save"
	if (closeVictoryModalBtn) {
		// Disabled: closeVictoryModalBtn.addEventListener('click', closeVictoryModal);
	}

	if (saveScoreBtn) {
		saveScoreBtn.addEventListener('click', saveScore);
	}

	if (skipLeaderboardBtn) {
		skipLeaderboardBtn.addEventListener('click', closeVictoryModal);
	}

	// Victory modal cannot be closed by clicking outside
	// Users must explicitly choose "Skip" or "Save"
	if (victoryModal) {
		// Disabled: victoryModal.addEventListener('click', (event) => {
		// 	if (event.target === victoryModal) {
		// 		closeVictoryModal();
		// 	}
		// });
	}

	if (nicknameInput) {
		nicknameInput.addEventListener('keydown', (event) => {
			if (event.key === 'Enter') {
				saveScore();
			}
		});
	}

	// Bind leaderboard refresh button
	if (refreshLeaderboardBtn) {
		refreshLeaderboardBtn.addEventListener('click', loadLeaderboard);
	}

	// Load leaderboard on startup
	setTimeout(() => loadLeaderboard(), 1000);
})();
