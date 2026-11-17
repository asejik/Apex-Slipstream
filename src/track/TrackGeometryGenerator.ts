import * as THREE from 'three';
import { TrackSpline } from './TrackSpline';
import { BARRIER_HEIGHT, barrierOffset } from './TrackBarriers';
import { brakingBoards, CornerZone, findCorners } from './TrackFurniture';
import { SCENE_COLOURS } from '../render/SceneSetup';
import { isDirtAt } from './TrackDefinitions';

/** Road and wall ribbons use one segment about every 5 m, so long laps stay smooth (R5) */
function ribbonSegments(trackSpline: TrackSpline): number {
  return Math.max(350, Math.ceil(trackSpline.totalLength / 5));
}

export class TrackGeometryGenerator {
  /** `extraFinishT`: a further finish gantry at that spline position (the sector sprint's line). */
  public static buildTrackMeshes(trackSpline: TrackSpline, extraFinishT?: number): THREE.Group {
    const trackGroup = new THREE.Group();

    // 1. Road Ribbon Mesh
    const roadMesh = this.createRoadRibbon(trackSpline);
    trackGroup.add(roadMesh);

    // 2. Kerbs through the corners, and braking boards before the slow ones
    const corners = findCorners(trackSpline);
    trackGroup.add(this.createCurbs(trackSpline, corners));
    trackGroup.add(this.createBrakingBoards(trackSpline, corners));

    // Pale lines along both road edges, so the road reads clearly against the grass
    trackGroup.add(this.createEdgeLine(trackSpline, -1));
    trackGroup.add(this.createEdgeLine(trackSpline, 1));

    // Walls along both sides of the track (U-04)
    trackGroup.add(this.createBarrier(trackSpline, -1, 'barrier-left'));
    trackGroup.add(this.createBarrier(trackSpline, 1, 'barrier-right'));

    // 3. Start / Finish Gantry Arch (on a sprint, at the start line past the run-up)
    const gantry = this.createStartFinishGantry(trackSpline, trackSpline.startT);
    trackGroup.add(gantry);

    // 4. Sprints finish at the far end of the road, so they get a second gantry there
    if (!trackSpline.data.isClosed) {
      trackGroup.add(this.createStartFinishGantry(trackSpline, 1));
    }

    // 5. The sector sprint ends part-way round: mark its line, so the finish is not a surprise
    if (extraFinishT !== undefined) {
      trackGroup.add(this.createStartFinishGantry(trackSpline, extraFinishT));
    }

    return trackGroup;
  }

  private static createRoadRibbon(trackSpline: TrackSpline): THREE.Mesh {
    const segments = ribbonSegments(trackSpline);
    const halfWidth = trackSpline.data.roadWidth / 2;

    const vertexCount = (segments + 1) * 2;
    const positions = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 3);
    const indices: number[] = [];

    const center = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const leftPos = new THREE.Vector3();
    const rightPos = new THREE.Vector3();

    // Asphalt dark gray
    const asphaltColor = new THREE.Color(SCENE_COLOURS.asphalt);
    // Vertex colours multiply the material colour: white leaves the asphalt as it is
    const edgeColor = new THREE.Color(0xffffff);
    // Dirt stretches (R7): a vertex colour that turns the asphalt colour into dirt brown
    const dirtTarget = new THREE.Color(SCENE_COLOURS.dirt);
    const dirtColor = new THREE.Color(
      dirtTarget.r / asphaltColor.r,
      dirtTarget.g / asphaltColor.g,
      dirtTarget.b / asphaltColor.b
    );

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      trackSpline.getPointAt(t, center);
      trackSpline.getNormalAt(t, normal);
      const vertexColor = isDirtAt(trackSpline.data, t) ? dirtColor : edgeColor;

      leftPos.copy(center).addScaledVector(normal, -halfWidth);
      rightPos.copy(center).addScaledVector(normal, halfWidth);

      // Vertex left
      const idxLeft = i * 2;
      positions[idxLeft * 3] = leftPos.x;
      positions[idxLeft * 3 + 1] = leftPos.y + 0.05;
      positions[idxLeft * 3 + 2] = leftPos.z;

      normals[idxLeft * 3] = 0;
      normals[idxLeft * 3 + 1] = 1;
      normals[idxLeft * 3 + 2] = 0;

      colors[idxLeft * 3] = vertexColor.r;
      colors[idxLeft * 3 + 1] = vertexColor.g;
      colors[idxLeft * 3 + 2] = vertexColor.b;

      // Vertex right
      const idxRight = i * 2 + 1;
      positions[idxRight * 3] = rightPos.x;
      positions[idxRight * 3 + 1] = rightPos.y + 0.05;
      positions[idxRight * 3 + 2] = rightPos.z;

      normals[idxRight * 3] = 0;
      normals[idxRight * 3 + 1] = 1;
      normals[idxRight * 3 + 2] = 0;

      colors[idxRight * 3] = vertexColor.r;
      colors[idxRight * 3 + 1] = vertexColor.g;
      colors[idxRight * 3 + 2] = vertexColor.b;

      // Indices for two triangles per quad
      if (i < segments) {
        const a = idxLeft;
        const b = idxRight;
        const c = idxLeft + 2;
        const d = idxRight + 2;

        indices.push(a, b, c);
        indices.push(b, d, c);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    const material = new THREE.MeshStandardMaterial({
      color: asphaltColor,
      vertexColors: true,
      roughness: 0.8,
      metalness: 0.1,
      flatShading: false,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'road';
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    return mesh;
  }

  /** A painted line along one edge of the road, just inside it. */
  private static createEdgeLine(trackSpline: TrackSpline, side: -1 | 1): THREE.Mesh {
    const segments = ribbonSegments(trackSpline);
    const outer = (trackSpline.data.roadWidth / 2) * side;
    const inner = outer - 0.35 * side;

    const positions = new Float32Array((segments + 1) * 2 * 3);
    const indices: number[] = [];
    const center = new THREE.Vector3();
    const normal = new THREE.Vector3();

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      trackSpline.getPointAt(t, center);
      trackSpline.getNormalAt(t, normal);
      const a = i * 2;
      const b = a + 1;
      positions[a * 3] = center.x + normal.x * inner;
      positions[a * 3 + 1] = center.y + 0.07; // just above the asphalt (0.05)
      positions[a * 3 + 2] = center.z + normal.z * inner;
      positions[b * 3] = center.x + normal.x * outer;
      positions[b * 3 + 1] = center.y + 0.07;
      positions[b * 3 + 2] = center.z + normal.z * outer;
      if (i < segments) {
        indices.push(a, b, a + 2);
        indices.push(b, b + 2, a + 2);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();

    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ color: SCENE_COLOURS.roadEdge, roughness: 0.7, side: THREE.DoubleSide })
    );
    mesh.name = side < 0 ? 'edge-line-left' : 'edge-line-right';
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    return mesh;
  }

  /** A wall ribbon along one side of the track, at the distance the physics enforces. */
  private static createBarrier(trackSpline: TrackSpline, side: -1 | 1, name: string): THREE.Mesh {
    const segments = ribbonSegments(trackSpline);
    const offset = barrierOffset(trackSpline.data.roadWidth) * side;

    const vertexCount = (segments + 1) * 2;
    const positions = new Float32Array(vertexCount * 3);
    const indices: number[] = [];

    const center = new THREE.Vector3();
    const normal = new THREE.Vector3();

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      trackSpline.getPointAt(t, center);
      trackSpline.getNormalAt(t, normal);
      center.addScaledVector(normal, offset);

      const bottom = i * 2;
      const top = bottom + 1;
      positions[bottom * 3] = center.x;
      positions[bottom * 3 + 1] = center.y;
      positions[bottom * 3 + 2] = center.z;
      positions[top * 3] = center.x;
      positions[top * 3 + 1] = center.y + BARRIER_HEIGHT;
      positions[top * 3 + 2] = center.z;

      if (i < segments) {
        indices.push(bottom, top, bottom + 2);
        indices.push(top, top + 2, bottom + 2);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();

    // Pale concrete, so the wall reads against the grass
    const material = new THREE.MeshStandardMaterial({
      color: SCENE_COLOURS.wall,
      roughness: 0.7,
      metalness: 0.2,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.frustumCulled = false;
    return mesh;
  }

  /**
   * Red and white kerbs along both edges through every corner (they used to be single blocks
   * dotted round the whole lap). Two instanced meshes: two draw calls for the whole track.
   */
  private static createCurbs(trackSpline: TrackSpline, corners: CornerZone[]): THREE.Group {
    const group = new THREE.Group();
    group.name = 'kerbs';
    const halfWidth = trackSpline.data.roadWidth / 2;
    const curbWidth = 1.6;
    const blockLength = 2.0;
    const padding = 10; // metres of kerb before and after the corner
    const length = trackSpline.totalLength;
    const isClosed = trackSpline.data.isClosed;

    // Where each block goes: distance along the lap, in metres
    const blocks: number[] = [];
    for (const corner of corners) {
      for (let m = corner.startM - padding; m < corner.endM + padding; m += blockLength) {
        if (!isClosed && (m < 0 || m > length)) continue;
        const along = ((m % length) + length) % length;
        // Dirt roads have no kerbs (R7)
        if (isDirtAt(trackSpline.data, along / length)) continue;
        blocks.push(along);
      }
    }

    const geometry = new THREE.BoxGeometry(curbWidth, 0.12, blockLength);
    const red = new THREE.InstancedMesh(
      geometry,
      new THREE.MeshStandardMaterial({ color: 0xee2233, roughness: 0.5 }),
      blocks.length
    );
    const white = new THREE.InstancedMesh(
      geometry,
      new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.5 }),
      blocks.length
    );

    const center = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const tangent = new THREE.Vector3();
    const forward = new THREE.Vector3(0, 0, 1);
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3(1, 1, 1);
    let redCount = 0;
    let whiteCount = 0;

    blocks.forEach((m, index) => {
      const t = m / length;
      trackSpline.getPointAt(t, center);
      trackSpline.getNormalAt(t, normal);
      trackSpline.getTangentAt(t, tangent);
      rotation.setFromUnitVectors(forward, tangent);
      for (const side of [-1, 1]) {
        position.copy(center).addScaledVector(normal, side * (halfWidth + curbWidth / 2));
        position.y += 0.06;
        matrix.compose(position, rotation, scale);
        // Alternate colours along the kerb, opposite on the two sides
        if ((index + (side > 0 ? 1 : 0)) % 2 === 0) {
          if (redCount < blocks.length) red.setMatrixAt(redCount++, matrix);
        } else if (whiteCount < blocks.length) {
          white.setMatrixAt(whiteCount++, matrix);
        }
      }
    });
    red.count = redCount;
    white.count = whiteCount;
    for (const mesh of [red, white]) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      group.add(mesh);
    }
    return group;
  }

  /**
   * Braking boards on top of both walls at 150, 100 and 50 m before each slow corner:
   * a white board with three, two and one dark bars. Two instanced meshes for the track.
   */
  private static createBrakingBoards(trackSpline: TrackSpline, corners: CornerZone[]): THREE.Group {
    const group = new THREE.Group();
    group.name = 'braking-boards';
    const boards = brakingBoards(trackSpline, corners);
    if (boards.length === 0) return group;

    const boardWidth = 1.4; // along the wall
    const boardHeight = 1.0;
    const offset = barrierOffset(trackSpline.data.roadWidth);
    const length = trackSpline.totalLength;

    const barCount = boards.reduce((n, b) => n + (b.distance === 150 ? 3 : b.distance === 100 ? 2 : 1), 0);
    const panels = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.08, boardHeight, boardWidth),
      new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.6 }),
      boards.length * 2
    );
    const bars = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.1, boardHeight * 0.8, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x121319, roughness: 0.6 }),
      barCount * 2
    );

    const center = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const tangent = new THREE.Vector3();
    const forward = new THREE.Vector3(0, 0, 1);
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3(1, 1, 1);
    let panelIndex = 0;
    let barIndex = 0;

    for (const board of boards) {
      const t = board.atM / length;
      trackSpline.getPointAt(t, center);
      trackSpline.getNormalAt(t, normal);
      trackSpline.getTangentAt(t, tangent);
      rotation.setFromUnitVectors(forward, tangent);
      const count = board.distance === 150 ? 3 : board.distance === 100 ? 2 : 1;
      for (const side of [-1, 1]) {
        position.copy(center).addScaledVector(normal, side * offset);
        position.y += BARRIER_HEIGHT + boardHeight / 2;
        matrix.compose(position, rotation, scale);
        panels.setMatrixAt(panelIndex++, matrix);
        // Bars spread along the board, standing just proud of both faces
        for (let k = 0; k < count; k++) {
          const along = (k - (count - 1) / 2) * 0.4;
          position.copy(center).addScaledVector(normal, side * offset).addScaledVector(tangent, along);
          position.y += BARRIER_HEIGHT + boardHeight / 2;
          matrix.compose(position, rotation, scale);
          bars.setMatrixAt(barIndex++, matrix);
        }
      }
    }
    for (const mesh of [panels, bars]) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = false;
      group.add(mesh);
    }
    return group;
  }

  /** Builds a gantry arch and chequered line across the road at spline position t. */
  private static createStartFinishGantry(trackSpline: TrackSpline, t = 0): THREE.Group {
    const gantry = new THREE.Group();
    const halfWidth = trackSpline.data.roadWidth / 2;

    const startPos = trackSpline.getPointAt(t);
    const startNormal = trackSpline.getNormalAt(t);

    // Gantry Pillars
    const pillarGeo = new THREE.CylinderGeometry(0.3, 0.4, 6.0, 8);
    const trussMat = new THREE.MeshStandardMaterial({ color: 0x222638, metalness: 0.8, roughness: 0.3 });

    const leftPillar = new THREE.Mesh(pillarGeo, trussMat);
    leftPillar.position.copy(startPos).addScaledVector(startNormal, -(halfWidth + 2.0));
    leftPillar.position.y += 3.0;
    leftPillar.castShadow = true;
    gantry.add(leftPillar);

    const rightPillar = new THREE.Mesh(pillarGeo, trussMat);
    rightPillar.position.copy(startPos).addScaledVector(startNormal, (halfWidth + 2.0));
    rightPillar.position.y += 3.0;
    rightPillar.castShadow = true;
    gantry.add(rightPillar);

    // Overhead Banner Box
    const bannerLength = trackSpline.data.roadWidth + 4.5;
    const bannerGeo = new THREE.BoxGeometry(bannerLength, 1.2, 0.4);
    const bannerMat = new THREE.MeshStandardMaterial({
      color: 0x00e699,
      roughness: 0.2,
      metalness: 0.5,
      flatShading: true
    });

    const bannerMesh = new THREE.Mesh(bannerGeo, bannerMat);
    bannerMesh.position.copy(startPos);
    bannerMesh.position.y += 5.5;
    bannerMesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), startNormal);
    bannerMesh.castShadow = true;
    gantry.add(bannerMesh);

    // Start/finish line strip, laid flat on the road and across it (U-14): its long side
    // runs along the road normal. The plane is built lying flat (XZ), then turned about Y.
    const lineGeo = new THREE.PlaneGeometry(trackSpline.data.roadWidth, 2.5);
    lineGeo.rotateX(-Math.PI / 2);
    const lineMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.6,
      side: THREE.DoubleSide
    });
    const finishLine = new THREE.Mesh(lineGeo, lineMat);
    finishLine.name = 'start-line';
    finishLine.position.copy(startPos);
    finishLine.position.y += 0.08;
    finishLine.rotation.y = Math.atan2(-startNormal.z, startNormal.x);
    finishLine.receiveShadow = true;
    gantry.add(finishLine);

    return gantry;
  }
}
