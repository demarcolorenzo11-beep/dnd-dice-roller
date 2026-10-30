
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

const diceElements = document.querySelectorAll(".dice");
const diceScenes = [];

// ==========================================
// SOMMATORE
// ==========================================

let sumEnabled = false;
let diceSum = 0;
let sumOperations = [];

const sumTotalElement = document.getElementById("sumTotal");
const sumHistoryElement = document.getElementById("sumHistory");
const sumToggleButton = document.getElementById("sumToggle");
const sumResetButton = document.getElementById("sumReset");

if (sumToggleButton) {
    sumToggleButton.addEventListener("click", () => {
        sumEnabled = !sumEnabled;

        sumToggleButton.textContent = sumEnabled
            ? "FERMA SOMMA"
            : "AVVIA SOMMA";
    });
}

if (sumResetButton) {
    sumResetButton.addEventListener("click", () => {
        diceSum = 0;
        sumOperations = [];

        if (sumTotalElement) {
            sumTotalElement.textContent = "0";
        }

        if (sumHistoryElement) {
            sumHistoryElement.textContent = "Nessun lancio";
        }
    });
}

// ==========================================
// CRONOLOGIA ULTIMI 10 RISULTATI
// ==========================================

const rollHistoryElement = document.getElementById("rollHistory");
let rollHistory = [];

function addToHistory(sides, result) {
    if (!rollHistoryElement) return;

    rollHistory.unshift({
        sides: sides,
        result: result
    });

    rollHistory = rollHistory.slice(0, 10);

    rollHistoryElement.innerHTML = "";

    rollHistory.forEach(roll => {
        const entry = document.createElement("div");
        entry.className = "history-entry";

        const die = document.createElement("span");
        die.textContent = `d${roll.sides}`;

        const value = document.createElement("strong");
        value.textContent = roll.result;

        entry.appendChild(die);
        entry.appendChild(value);

        rollHistoryElement.appendChild(entry);
    });
}

// ==========================================
// FUNZIONI GENERALI
// ==========================================

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ==========================================
// GEOMETRIA D10 E D100
// ==========================================

function createD10Geometry() {
    const positions = [];

    const top = new THREE.Vector3(0, 0.85, 0);
    const bottom = new THREE.Vector3(0, -0.85, 0);
    const ring = [];

    for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;

        ring.push(new THREE.Vector3(
            Math.cos(angle) * 1.05,
            0,
            Math.sin(angle) * 1.05
        ));
    }

    function addTriangle(a, b, c) {
        const normal = new THREE.Vector3()
            .subVectors(b, a)
            .cross(new THREE.Vector3().subVectors(c, a));

        const center = new THREE.Vector3()
            .addVectors(a, b)
            .add(c)
            .divideScalar(3);

        if (normal.dot(center) < 0) {
            [b, c] = [c, b];
        }

        positions.push(...a.toArray(), ...b.toArray(), ...c.toArray());
    }

    for (let i = 0; i < 5; i++) {
        const next = (i + 1) % 5;

        addTriangle(top, ring[i], ring[next]);
        addTriangle(bottom, ring[next], ring[i]);
    }

    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3)
    );

    geometry.computeVertexNormals();

    return geometry;
}

// ==========================================
// RICONOSCIMENTO DELLE FACCE
// ==========================================

function getFaces(geometry) {
    const geo = geometry.index ? geometry.toNonIndexed() : geometry;
    const positions = geo.attributes.position;
    const faces = [];

    for (let i = 0; i < positions.count; i += 3) {
        const a = new THREE.Vector3().fromBufferAttribute(positions, i);
        const b = new THREE.Vector3().fromBufferAttribute(positions, i + 1);
        const c = new THREE.Vector3().fromBufferAttribute(positions, i + 2);

        const normal = new THREE.Vector3()
            .subVectors(b, a)
            .cross(new THREE.Vector3().subVectors(c, a))
            .normalize();

        const plane = normal.dot(a);

        let face = faces.find(f =>
            f.normal.dot(normal) > 0.9999 &&
            Math.abs(f.plane - plane) < 0.015
        );

        if (!face) {
            face = {
                normal: normal.clone(),
                plane,
                points: []
            };

            faces.push(face);
        }

        face.points.push(a, b, c);
    }

    faces.forEach(face => {
        const unique = new Map();

        face.points.forEach(point => {
            const key = [
                point.x.toFixed(4),
                point.y.toFixed(4),
                point.z.toFixed(4)
            ].join(",");

            unique.set(key, point);
        });

        const points = [...unique.values()];
        const center = new THREE.Vector3();

        points.forEach(point => center.add(point));
        center.divideScalar(points.length);

        face.center = center;

        if (face.normal.dot(center) < 0) {
            face.normal.negate();
        }
    });

    return faces;
}

// ==========================================
// TEXTURE DEI NUMERI
// ==========================================

function createNumberTexture(number) {
    const canvas = document.createElement("canvas");

    canvas.width = 256;
    canvas.height = 256;

    const context = canvas.getContext("2d");

    context.clearRect(0, 0, 256, 256);

    const text = String(number);

    let fontSize = 100;

    if (text.length === 2) fontSize = 85;
    if (text.length === 3) fontSize = 65;

    context.fillStyle = "#30291f";
    context.font = `bold ${fontSize}px Georgia`;
    context.textAlign = "center";
    context.textBaseline = "middle";

    context.fillText(text, 128, 130);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    return texture;
}

// ==========================================
// CREAZIONE DEI DADI
// ==========================================

function createDice(sides, scene) {
    let geometry;
    let faceValues;

    switch (sides) {
        case 4:
            geometry = new THREE.TetrahedronGeometry(1.25);
            faceValues = [1, 2, 3, 4];
            break;

        case 6:
            geometry = new THREE.BoxGeometry(1.65, 1.65, 1.65);
            faceValues = [1, 2, 3, 4, 5, 6];
            break;

        case 8:
            geometry = new THREE.OctahedronGeometry(1.3);
            faceValues = [1, 2, 3, 4, 5, 6, 7, 8];
            break;

        case 10:
            geometry = createD10Geometry();
            faceValues = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
            break;

        case 12:
            geometry = new THREE.DodecahedronGeometry(1.25);
            faceValues = Array.from({ length: 12 }, (_, i) => i + 1);
            break;

        case 20:
            geometry = new THREE.IcosahedronGeometry(1.3);
            faceValues = Array.from({ length: 20 }, (_, i) => i + 1);
            break;

        case 100:
            geometry = createD10Geometry();
            faceValues = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
            break;

        default:
            throw new Error(`Dado non supportato: d${sides}`);
    }

    const group = new THREE.Group();

    const material = new THREE.MeshStandardMaterial({
        color: 0xe8d9bd,
        roughness: 0.38,
        metalness: 0.02,
        flatShading: true,
        transparent: false,
        opacity: 1,
        side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geometry, material);

    mesh.castShadow = true;
    mesh.receiveShadow = true;

    group.add(mesh);

    const edges = new THREE.EdgesGeometry(geometry, 15);

    const edgeLines = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({
            color: 0x8c7c62
        })
    );

    group.add(edgeLines);

    // Dimensione dei numeri

    let labelSize = 0.96;

    if (sides === 6) labelSize = 1.35;
    if (sides === 8) labelSize = 1.10;
    if (sides === 10) labelSize = 0.60;
    if (sides === 12) labelSize = 0.85;
    if (sides === 20) labelSize = 0.75;
    if (sides === 100) labelSize = 0.60;

    const faces = getFaces(geometry);

    faces.forEach((face, index) => {
        face.value = faceValues[index];

        const labelGeometry = new THREE.PlaneGeometry(
            labelSize,
            labelSize
        );

        const labelMaterial = new THREE.MeshBasicMaterial({
            map: createNumberTexture(face.value),
            transparent: true,
            opacity: 1,
            alphaTest: 0.01,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        const numberMesh = new THREE.Mesh(
            labelGeometry,
            labelMaterial
        );

        numberMesh.position.copy(
            face.center.clone().add(
                face.normal.clone().multiplyScalar(0.018)
            )
        );

        numberMesh.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 0, 1),
            face.normal
        );

        numberMesh.renderOrder = 2;

        group.add(numberMesh);
    });

    scene.add(group);

    return {
        group,
        faces,
        sides,
        rolling: false
    };
}

// ==========================================
// ORIENTAMENTO FINALE DEL DADO
// ==========================================

function getTargetQuaternion(face) {
    const front = new THREE.Vector3(0, 0, 1);

    return new THREE.Quaternion().setFromUnitVectors(
        face.normal.clone().normalize(),
        front
    );
}

// ==========================================
// OMBRA MORBIDA
// ==========================================

function createSoftShadow(scene) {
    const canvas = document.createElement("canvas");

    canvas.width = 256;
    canvas.height = 256;

    const context = canvas.getContext("2d");

    const gradient = context.createRadialGradient(
        128, 128, 5,
        128, 128, 128
    );

    gradient.addColorStop(0, "rgba(0,0,0,0.65)");
    gradient.addColorStop(0.25, "rgba(0,0,0,0.40)");
    gradient.addColorStop(0.55, "rgba(0,0,0,0.15)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");

    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);

    const texture = new THREE.CanvasTexture(canvas);

    const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(2.5, 2.5),
        new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: 0.8,
            depthWrite: false,
            toneMapped: false
        })
    );

    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -1.235;

    scene.add(shadow);

    return shadow;
}

// ==========================================
// CREAZIONE SCENA 3D
// ==========================================

function createScene(element, sides) {
    const scene = new THREE.Scene();

    scene.background = new THREE.Color("#111923");

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);

    camera.position.set(0, 1.1, 5.1);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    element.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 1.5));

    const mainLight = new THREE.DirectionalLight(0xffffff, 3);

    mainLight.position.set(-3, 5, 4);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.set(1024, 1024);

    scene.add(mainLight);

    const fillLight = new THREE.PointLight(0xc1d5ff, 35);

    fillLight.position.set(3, 1, -3);

    scene.add(fillLight);

    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(20, 20),
        new THREE.ShadowMaterial({ opacity: 0.15 })
    );

    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.25;
    floor.receiveShadow = true;

    scene.add(floor);

    const dice = createDice(sides, scene);
    const shadow = createSoftShadow(scene);

    if (sides === 6) {
        dice.group.scale.setScalar(0.90);
    }

    function resize() {
        const width = element.clientWidth;
        const height = element.clientHeight;

        renderer.setSize(width, height, false);

        camera.aspect = width / height;
        camera.updateProjectionMatrix();

        renderer.render(scene, camera);
    }

    resize();

    const item = {
        scene,
        camera,
        renderer,
        dice,
        shadow,
        resize
    };

    diceScenes.push(item);

    return item;
}

// ==========================================
// AGGIUNTA RISULTATO AL SOMMATORE
// ==========================================

function addToSum(result) {
    if (!sumTotalElement || !sumHistoryElement) return;

    diceSum += result;
    sumOperations.push(result);

    sumTotalElement.textContent = diceSum;
    sumHistoryElement.textContent = sumOperations.join(" + ");
}

// ==========================================
// LANCIO DEL DADO
// ==========================================

function launchDice(item, label) {
    const dice = item.dice;

    if (dice.rolling) return;

    dice.rolling = true;

    // Il lancio viene contato solo se la somma è attiva
    const countThisRoll = sumEnabled;

    const selectedFace = dice.faces[
        randomInt(0, dice.faces.length - 1)
    ];

    const result = selectedFace.value;

    const startQuaternion = dice.group.quaternion.clone();
    const targetQuaternion = getTargetQuaternion(selectedFace);

    const spinAxis = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
    ).normalize();

    const startTime = performance.now();
    const duration = 1300;

    function animate(now) {
        const progress = Math.min(
            (now - startTime) / duration,
            1
        );

        const eased = 1 - Math.pow(1 - progress, 3);

        const currentQuaternion = startQuaternion.clone().slerp(
            targetQuaternion,
            eased
        );

        const spin = new THREE.Quaternion().setFromAxisAngle(
            spinAxis,
            Math.PI * 6 * (1 - eased)
        );

        dice.group.quaternion.copy(
            spin.multiply(currentQuaternion)
        );

        const jumpHeight = Math.sin(Math.PI * eased);

        dice.group.position.y = jumpHeight * 1.05;

        const shadowSize = 0.65 + jumpHeight * 0.85;

        item.shadow.scale.set(
            shadowSize,
            shadowSize,
            shadowSize
        );

        item.shadow.material.opacity = 0.8 - jumpHeight * 0.58;

        item.renderer.render(item.scene, item.camera);

        if (progress < 1) {
            requestAnimationFrame(animate);

        } else {
            dice.group.position.y = 0;
            dice.group.quaternion.copy(targetQuaternion);

            item.shadow.scale.setScalar(0.65);
            item.shadow.material.opacity = 0.8;

            label.textContent = `d${dice.sides} · ${result}`;

            // Aggiorna sempre la cronologia
            addToHistory(dice.sides, result);

            // Aggiorna il sommatore solo se attivo
            if (countThisRoll) {
                addToSum(result);
            }

            dice.rolling = false;

            item.renderer.render(item.scene, item.camera);
        }
    }

    requestAnimationFrame(animate);
}

// ==========================================
// INIZIALIZZAZIONE DEI DADI
// ==========================================

diceElements.forEach(element => {
    const sides = Number(element.dataset.sides);

    const sceneElement = element.querySelector(".scene");
    const label = element.querySelector(".dice-label");

    const item = createScene(sceneElement, sides);

    element.addEventListener("click", () => {
        launchDice(item, label);
    });
});

// ==========================================
// ADATTAMENTO ALLA FINESTRA
// ==========================================

window.addEventListener("resize", () => {
    diceScenes.forEach(item => item.resize());
});
