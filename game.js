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
	const focusBtn = document.getElementById('focus-btn');
	const focusExitBtn = document.getElementById('focus-exit-btn');
	const customizeKeysBtn = document.getElementById('customize-keys-btn');
	const keyboardModal = document.getElementById('keyboard-modal');
	const closeModalBtn = document.getElementById('close-modal-btn');
	const saveKeysBtn = document.getElementById('save-keys-btn');
	const resetKeysBtn = document.getElementById('reset-keys-btn');

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
		latestMessage: '섞기 버튼으로 게임을 시작하세요!',
		moveHistory: [],
		isRotating: false,
		isTransparent: false
	};

	// Keyboard shortcut settings - customizable
	const defaultKeyboardSettings = {
		U: 'KeyU',
		D: 'KeyD',
		L: 'KeyL',
		R: 'KeyR',
		F: 'KeyF',
		B: 'KeyB',
		toggleTransparency: 'KeyT'
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

		const floor = new THREE.Mesh(
			new THREE.CircleGeometry(6.2, 64),
			new THREE.MeshStandardMaterial({
				color: 0x0f172a,
				roughness: 0.95,
				metalness: 0.05,
				transparent: true,
				opacity: 0.9
			})
		);
		floor.rotation.x = -Math.PI / 2;
		floor.position.y = -2.2;
		floor.receiveShadow = true;
		scene.add(floor);
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
			const input = document.getElementById(`key-${key}`);
			const display = document.querySelector(`.key-display[data-key="${key}"]`);
			if (input) {
				input.value = formatKeyCode(keyboardSettings[key]);
			}
			if (display) {
				display.textContent = formatKeyCode(keyboardSettings[key]);
			}
		});

		keyboardModal.style.display = 'flex';
		setupKeyListeners();
	}

	function closeKeyboardModal() {
		keyboardModal.style.display = 'none';
		removeKeyListeners();
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
			const input = document.getElementById(`key-${key}`);
			const display = document.querySelector(`.key-display[data-key="${key}"]`);
			if (input) {
				input.value = formatKeyCode(keyboardSettings[key]);
			}
			if (display) {
				display.textContent = formatKeyCode(keyboardSettings[key]);
			}
		});
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
	}

	function toggleTransparency() {
		state.isTransparent = !state.isTransparent;
		const opacity = state.isTransparent ? 0.3 : 1.0;
		
		cubelets.forEach((cubelet) => {
			if (Array.isArray(cubelet.mesh.material)) {
				cubelet.mesh.material.forEach((material) => {
					material.transparent = true;
					material.opacity = opacity;
					material.needsUpdate = true;
				});
			} else {
				cubelet.mesh.material.transparent = true;
				cubelet.mesh.material.opacity = opacity;
				cubelet.mesh.material.needsUpdate = true;
			}
		});
		
		setMessage(state.isTransparent ? '메시가 반투명으로 변경되었습니다.' : '메시가 불투명으로 변경되었습니다.');
	}

	function bindKeyboardShortcuts() {
		// Build key map from settings
		const keyMap = {};
		keyMap[keyboardSettings.U] = { axis: 'y', layer: 1 };
		keyMap[keyboardSettings.D] = { axis: 'y', layer: -1 };
		keyMap[keyboardSettings.L] = { axis: 'x', layer: -1 };
		keyMap[keyboardSettings.R] = { axis: 'x', layer: 1 };
		keyMap[keyboardSettings.F] = { axis: 'z', layer: 1 };
		keyMap[keyboardSettings.B] = { axis: 'z', layer: -1 };

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
			// Check for transparency toggle
			if (event.code === keyboardSettings.toggleTransparency) {
				event.preventDefault();
				toggleTransparency();
				return;
			}

			const mapped = keyMap[event.code];
			if (!mapped) {
				return;
			}

			event.preventDefault();
			if (state.isRotating) {
				return;
			}

			const direction = event.shiftKey ? -1 : 1;
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
			lastDistance: distanceBetweenPointers(p1, p2)
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

		const axisName = dominantAxisFromNormal(normal);
		const axisVector = AXIS_VECTORS[axisName];
		const layer = Math.round(cubelet.logicalPosition[axisName]);
		if (!layer) {
			return null;
		}

		const tangentA = new THREE.Vector3(0, 1, 0);
		if (Math.abs(tangentA.dot(normal)) > 0.9) {
			tangentA.set(1, 0, 0);
		}
		tangentA.cross(normal).normalize();
		const tangentB = new THREE.Vector3().crossVectors(normal, tangentA).normalize();

		const projections = [
			projectDirectionToScreen(point, tangentA),
			projectDirectionToScreen(point, tangentB)
		];

		const dragLength = dragVec.length();
		if (dragLength === 0) {
			return null;
		}

		const alignment = projections.map((proj) => {
			const denom = proj.length() * dragLength;
			if (!denom) {
				return { score: 0, sign: 0 };
			}
			const scoreRaw = proj.dot(dragVec) / denom;
			return { score: Math.abs(scoreRaw), sign: Math.sign(scoreRaw) || 1 };
		});

		const dominantIndex = alignment[0].score >= alignment[1].score ? 0 : 1;
		const dominantTangent = dominantIndex === 0 ? tangentA : tangentB;
		const dominantSign = alignment[dominantIndex].sign || 1;

		// For front face (z-axis, layer=1), rotate adjacent faces instead
		let finalAxis = axisName;
		let finalLayer = layer;
		
		if (axisName === 'z' && layer === 1) {
			// Determine which adjacent axis to use based on dominant tangent
			// tangentA and tangentB are perpendicular to the front face normal
			const absX = Math.abs(dominantTangent.x);
			const absY = Math.abs(dominantTangent.y);
			
			if (absX > absY) {
				// Horizontal drag → rotate left/right face (x-axis)
				finalAxis = 'x';
				// dominantTangent.x > 0 means dragging right → rotate right face (layer 1)
				// dominantTangent.x < 0 means dragging left → rotate left face (layer -1)
				finalLayer = dominantTangent.x > 0 ? 1 : -1;
			} else {
				// Vertical drag → rotate up/down face (y-axis)
				finalAxis = 'y';
				// dominantTangent.y > 0 means dragging up → rotate up face (layer 1)
				// dominantTangent.y < 0 means dragging down → rotate down face (layer -1)
				finalLayer = dominantTangent.y > 0 ? 1 : -1;
			}
		}

		const finalAxisVector = AXIS_VECTORS[finalAxis];
		const samplePoint = point.clone().add(dominantTangent.clone().multiplyScalar(0.35));
		const baseAngle = Math.PI / 2;
		const screenStart = projectPointToScreen(samplePoint);

		let bestSign = null;
		let bestScore = -Infinity;
		const normalizedDrag = dragVec.clone().normalize();

		for (const sign of [1, -1]) {
			const rotatedPoint = rotatePointAroundAxis(samplePoint, finalAxisVector, sign * baseAngle);
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
			bestSign = dominantSign;
		}

		const direction = deriveDirectionFromAngleSign(bestSign, finalLayer);

		return {
			axis: finalAxis,
			layer: finalLayer,
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
		const layer = move.layer === -1 ? -1 : 1;
		const direction = move.direction === -1 ? -1 : 1;
		const angle = computeActualAngle(axis, layer, direction);
		const notation = move.notation || `${FACE_NOTATION[axis][layer]}${direction === 1 ? '' : "'"}`;
		const duration = move.duration ?? 200;

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
		updateHud(move.notation);
		if (isCubeSolved()) {
			setMessage('축하합니다! 큐브를 완성했습니다!', { celebrate: true });
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

	function scrambleCube() {
		const scrambleLength = 24;
		const moves = [];
		const options = [
			{ axis: 'x', layer: 1 },
			{ axis: 'x', layer: -1 },
			{ axis: 'y', layer: 1 },
			{ axis: 'y', layer: -1 },
			{ axis: 'z', layer: 1 },
			{ axis: 'z', layer: -1 }
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
				record: false
			});
		}

		if (!moves.length) {
			return;
		}

		state.moveHistory.length = 0;
		state.moveCount = 0;
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
})();
