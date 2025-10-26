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
	const keyboardModal = document.getElementById('keyboard-modal');
	const closeModalBtn = document.getElementById('close-modal-btn');
	const saveKeysBtn = document.getElementById('save-keys-btn');
	const resetKeysBtn = document.getElementById('reset-keys-btn');
	const backViewBtn = document.getElementById('back-view-btn');

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
		base: 0x1f2937,
		right: 0xef4444,
		left: 0xf97316,
		up: 0xf8fafc,
		down: 0xfacc15,
		front: 0x22c55e,
		back: 0x3b82f6
	};

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
		rotationSpeed: 200
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
		cameraRelativeMode: true  // true = camera-relative, false = fixed-axis
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
		maxDistance: 12
	};

	let cameraDistance = 7.4;
	let dragState = null;
	let gestureState = null;

	const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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

	addEnvironment();
	buildCube();
	updateCameraPosition();
	onResize();

	if (window.ResizeObserver) {
		const resizeObserver = new ResizeObserver(onResize);
		resizeObserver.observe(stageEl);
	}
	window.addEventListener('resize', onResize);

	bindUIEvents();
	bindPointerEvents();
	bindKeyboardShortcuts();

	setMessage(state.latestMessage);
	animate();

	// Auto-scramble on game initialization to prevent cheating
	// Delay allows the 3D scene to fully render before scrambling begins
	const AUTO_SCRAMBLE_DELAY_MS = 500;
	setTimeout(() => {
		scrambleCube();
	}, AUTO_SCRAMBLE_DELAY_MS);

	function addEnvironment() {
		scene.add(new THREE.HemisphereLight(0xffffff, 0x0f172a, 0.85));

		const dirLight = new THREE.DirectionalLight(0xffffff, 1.05);
		dirLight.position.set(6, 10, 8);
		dirLight.castShadow = true;
		dirLight.shadow.mapSize.set(2048, 2048);
		dirLight.shadow.camera.near = 2;
		dirLight.shadow.camera.far = 30;
		scene.add(dirLight);

		const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.35);
		rimLight.position.set(-8, -6, -4);
		scene.add(rimLight);
	}

	function buildCube() {
		const cubeGroup = new THREE.Group();
		scene.add(cubeGroup);

		const cubeletSize = 0.95;
		const spacing = 1.05;
		const geometry = new THREE.BoxGeometry(cubeletSize, cubeletSize, cubeletSize);

		const faceMaterialsCache = new Map();

		const getFaceMaterial = (color) => {
			if (!faceMaterialsCache.has(color)) {
				const material = new THREE.MeshStandardMaterial({
					color,
					roughness: 0.35,
					metalness: 0.1,
					polygonOffset: true,
					polygonOffsetFactor: color === COLORS.base ? 0 : -1,
					emissive: color === COLORS.base ? 0x000000 : color,
					emissiveIntensity: color === COLORS.base ? 0.05 : 0.12
				});
				faceMaterialsCache.set(color, material);
			}
			return faceMaterialsCache.get(color);
		};

		for (let x = -1; x <= 1; x += 1) {
			for (let y = -1; y <= 1; y += 1) {
				for (let z = -1; z <= 1; z += 1) {
					if (x === 0 && y === 0 && z === 0) {
						continue;
					}

					const materials = [
						getFaceMaterial(x === 1 ? COLORS.right : COLORS.base),
						getFaceMaterial(x === -1 ? COLORS.left : COLORS.base),
						getFaceMaterial(y === 1 ? COLORS.up : COLORS.base),
						getFaceMaterial(y === -1 ? COLORS.down : COLORS.base),
						getFaceMaterial(z === 1 ? COLORS.front : COLORS.base),
						getFaceMaterial(z === -1 ? COLORS.back : COLORS.base)
					];

					const mesh = new THREE.Mesh(geometry, materials);
					mesh.castShadow = true;
					mesh.receiveShadow = true;
					mesh.position.set(x * spacing, y * spacing, z * spacing);

					const cubelet = {
						mesh,
						logicalPosition: new THREE.Vector3(x, y, z),
						initialLogicalPosition: new THREE.Vector3(x, y, z),
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
					cubeGroup.add(mesh);
					cubelets.push(cubelet);
				}
			}
		}

		scene.userData.cubeGroup = cubeGroup;
		scene.userData.spacing = spacing;
	}

	function resetCube() {
		const spacing = scene.userData.spacing;
		cubelets.forEach((cubelet) => {
			cubelet.logicalPosition.copy(cubelet.initialLogicalPosition);
			cubelet.orientation.x.copy(cubelet.initialOrientation.x);
			cubelet.orientation.y.copy(cubelet.initialOrientation.y);
			cubelet.orientation.z.copy(cubelet.initialOrientation.z);

			cubelet.mesh.position.set(
				cubelet.logicalPosition.x * spacing,
				cubelet.logicalPosition.y * spacing,
				cubelet.logicalPosition.z * spacing
			);

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
			if (key === 'cameraRelativeMode') return;
			
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
			if (key === 'cameraRelativeMode') return;
			
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
					setMessage('최근 이동을 되돌렸습니다.');
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
				cubelet.mesh.material.forEach((material) => {
					if (state.isBackFaceView) {
						// In back face view mode:
						// - Hide interior (base color) faces
						// - Show back faces of colored materials
						if (material.color.getHex() === COLORS.base) {
							material.visible = false;
						} else {
							material.side = THREE.BackSide;
						}
					} else {
						// In front face view mode: restore default
						material.visible = true;
						material.side = THREE.FrontSide;
					}
					material.needsUpdate = true;
				});
			} else {
				if (state.isBackFaceView) {
					if (cubelet.mesh.material.color.getHex() === COLORS.base) {
						cubelet.mesh.material.visible = false;
					} else {
						cubelet.mesh.material.side = THREE.BackSide;
					}
				} else {
					cubelet.mesh.material.visible = true;
					cubelet.mesh.material.side = THREE.FrontSide;
				}
				cubelet.mesh.material.needsUpdate = true;
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
	}

	function updateOrbit(clientX, clientY) {
		if (!orbitState.startPos) {
			return;
		}

		const deltaX = (clientX - orbitState.startPos.x) * 0.005;
		const deltaY = (clientY - orbitState.startPos.y) * 0.005;

		orbitState.theta = orbitState.startTheta - deltaX;
		orbitState.phi = orbitState.startPhi - deltaY;

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

		const panDelta = midpoint.clone().sub(gestureState.lastMidpoint);
		panCamera(panDelta.x, panDelta.y);
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
				orbitState.theta += angleDelta;
				// Normalize theta to [0, 2π] to prevent overflow
				orbitState.theta = ((orbitState.theta % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
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

		if (absX >= absY && absX >= absZ) {
			rotationAxisName = 'x';
			// Layer is determined by the cubelet's position on this axis
			rotationLayer = Math.round(cubelet.logicalPosition.x);
		} else if (absY >= absX && absY >= absZ) {
			rotationAxisName = 'y';
			rotationLayer = Math.round(cubelet.logicalPosition.y);
		} else {
			rotationAxisName = 'z';
			rotationLayer = Math.round(cubelet.logicalPosition.z);
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
			// Middle layer: use consistent direction mapping across all axes
			return angleSign > 0 ? 1 : -1;
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
		const intersects = raycaster.intersectObjects(cubelets.map((c) => c.mesh));
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
		const layer = move.layer;  // Allow -1, 0, and 1
		const direction = move.direction === -1 ? -1 : 1;
		const angle = computeActualAngle(axis, layer, direction);
		// Standard cube notation: M (x-axis middle), E (y-axis middle), S (z-axis middle)
		const middleLayerNotation = axis === 'x' ? 'M' : (axis === 'y' ? 'E' : 'S');
		const notation = move.notation || `${FACE_NOTATION[axis]?.[layer] || middleLayerNotation}${direction === 1 ? '' : "'"}`;
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
		const layerCubelets = cubelets.filter((cubelet) => Math.round(cubelet.logicalPosition[move.axis]) === move.layer);
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
		if (layer === 0) {
			// Middle layer: use consistent direction mapping
			return -direction * base;
		}
		const viewAlignment = layer === 1 ? 1 : -1;
		return -direction * viewAlignment * base;
	}

	function animateLayerRotation(cubeletGroup, axisVector, targetAngle, duration, onDone) {
		const start = performance.now();
		let previousAngle = 0;

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
				onDone();
			}
		}

		requestAnimationFrame(step);
	}

	function finalizeLayer(cubeletGroup, rotationMatrix3) {
		const spacing = scene.userData.spacing;

		cubeletGroup.forEach((cubelet) => {
			cubelet.logicalPosition.applyMatrix3(rotationMatrix3);
			cubelet.logicalPosition.set(
				Math.round(cubelet.logicalPosition.x),
				Math.round(cubelet.logicalPosition.y),
				Math.round(cubelet.logicalPosition.z)
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

			cubelet.mesh.position.set(
				cubelet.logicalPosition.x * spacing,
				cubelet.logicalPosition.y * spacing,
				cubelet.logicalPosition.z * spacing
			);

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
		const gameTime = Math.floor((Date.now() - state.gameStartTime) / 1000);
		state.lastGameTime = gameTime;
		
		setMessage('축하합니다! 큐브를 완성했습니다!', { celebrate: true });
		
		// Open victory modal after a short delay
		setTimeout(() => {
			openVictoryModal(state.moveCount, gameTime);
		}, 800);
	}

	function scrambleCube() {
		const scrambleLength = 24;
		const moves = [];
		const options = [
			{ axis: 'x', layer: 1 },
			{ axis: 'x', layer: -1 },
			{ axis: 'x', layer: 0 },
			{ axis: 'y', layer: 1 },
			{ axis: 'y', layer: -1 },
			{ axis: 'y', layer: 0 },
			{ axis: 'z', layer: 1 },
			{ axis: 'z', layer: -1 },
			{ axis: 'z', layer: 0 }
		];

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

	function panCamera(deltaX, deltaY) {
		if (deltaX === 0 && deltaY === 0) {
			return;
		}

		const panSpeed = cameraDistance * 0.0016;
		const rect = renderer.domElement.getBoundingClientRect();
		const normalizedDeltaX = deltaX / rect.width;
		const normalizedDeltaY = deltaY / rect.height;

		const forward = tmpVec3
			.subVectors(cameraTarget, camera.position)
			.normalize();
		const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
		const up = new THREE.Vector3().crossVectors(right, forward).normalize();

		const move = right.multiplyScalar(-normalizedDeltaX * panSpeed * rect.width)
			.add(up.multiplyScalar(normalizedDeltaY * panSpeed * rect.height));

		cameraTarget.add(move);
		camera.position.add(move);
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
			} else {
				// Exiting focus mode
				focusBtn.textContent = '집중 모드';
			}
		}
		
		// Trigger resize to adjust canvas
		setTimeout(() => {
			onResize();
		}, 100);
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
			{ nickname: '큐브마스터', moves: 45, time: 123 },
			{ nickname: '퍼즐왕', moves: 52, time: 156 },
			{ nickname: '스피드큐버', moves: 58, time: 98 },
			{ nickname: 'CubeNinja', moves: 61, time: 145 },
			{ nickname: '3D전문가', moves: 67, time: 178 }
		];
		
		demoData.forEach((data, index) => {
			const entry = createLeaderboardEntry(index + 1, data.nickname, data.moves, data.time);
			leaderboardList.appendChild(entry);
		});
	}

	function createLeaderboardEntry(rank, nickname, moves, timeInSeconds) {
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
		timeEl.textContent = formatTime(timeInSeconds);
		
		entry.appendChild(rankEl);
		entry.appendChild(nameEl);
		entry.appendChild(movesEl);
		entry.appendChild(timeEl);
		
		return entry;
	}

	function formatTime(seconds) {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	function openVictoryModal(moves, timeInSeconds) {
		victoryMoveCount.textContent = moves;
		victoryTime.textContent = formatTime(timeInSeconds);
		
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
