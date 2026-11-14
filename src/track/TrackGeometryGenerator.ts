import * as THREE from 'three';
import { TrackSpline } from './TrackSpline';

export class TrackGeometryGenerator {
  public static buildTrackMeshes(trackSpline: TrackSpline): THREE.Group {
    const trackGroup = new THREE.Group();

    // 1. Road Ribbon Mesh
    const roadMesh = this.createRoadRibbon(trackSpline);
    trackGroup.add(roadMesh);

    // 2. Corner Curbs (Rumble strips)
    const curbsGroup = this.createCurbs(trackSpline);
    trackGroup.add(curbsGroup);

    // 3. Start / Finish Gantry Arch
    const gantry = this.createStartFinishGantry(trackSpline);
    trackGroup.add(gantry);

    return trackGroup;
  }

  private static createRoadRibbon(trackSpline: TrackSpline): THREE.Mesh {
    const segments = 350;
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
    const asphaltColor = new THREE.Color(0x191c26);
    const edgeColor = new THREE.Color(0x44485a);

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      trackSpline.getPointAt(t, center);
      trackSpline.getNormalAt(t, normal);

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

      colors[idxLeft * 3] = edgeColor.r;
      colors[idxLeft * 3 + 1] = edgeColor.g;
      colors[idxLeft * 3 + 2] = edgeColor.b;

      // Vertex right
      const idxRight = i * 2 + 1;
      positions[idxRight * 3] = rightPos.x;
      positions[idxRight * 3 + 1] = rightPos.y + 0.05;
      positions[idxRight * 3 + 2] = rightPos.z;

      normals[idxRight * 3] = 0;
      normals[idxRight * 3 + 1] = 1;
      normals[idxRight * 3 + 2] = 0;

      colors[idxRight * 3] = edgeColor.r;
      colors[idxRight * 3 + 1] = edgeColor.g;
      colors[idxRight * 3 + 2] = edgeColor.b;

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
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    return mesh;
  }

  private static createCurbs(trackSpline: TrackSpline): THREE.Group {
    const curbsGroup = new THREE.Group();
    const segments = 180;
    const halfWidth = trackSpline.data.roadWidth / 2;
    const curbWidth = 1.6;

    const curbBoxGeo = new THREE.BoxGeometry(curbWidth, 0.12, 1.8);
    const redMat = new THREE.MeshStandardMaterial({ color: 0xee2233, roughness: 0.5, flatShading: true });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.5, flatShading: true });

    const center = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const tangent = new THREE.Vector3();

    for (let i = 0; i < segments; i += 2) {
      const t = i / segments;
      trackSpline.getPointAt(t, center);
      trackSpline.getNormalAt(t, normal);
      trackSpline.getTangentAt(t, tangent);

      const mat = (i % 4 === 0) ? redMat : whiteMat;

      // Left curb block
      const leftCurb = new THREE.Mesh(curbBoxGeo, mat);
      leftCurb.position.copy(center).addScaledVector(normal, -(halfWidth + curbWidth / 2));
      leftCurb.position.y += 0.06;
      leftCurb.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
      leftCurb.receiveShadow = true;
      leftCurb.frustumCulled = false;
      curbsGroup.add(leftCurb);

      // Right curb block
      const rightCurb = new THREE.Mesh(curbBoxGeo, mat);
      rightCurb.position.copy(center).addScaledVector(normal, (halfWidth + curbWidth / 2));
      rightCurb.position.y += 0.06;
      rightCurb.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
      rightCurb.receiveShadow = true;
      rightCurb.frustumCulled = false;
      curbsGroup.add(rightCurb);
    }

    return curbsGroup;
  }

  private static createStartFinishGantry(trackSpline: TrackSpline): THREE.Group {
    const gantry = new THREE.Group();
    const halfWidth = trackSpline.data.roadWidth / 2;

    const startPos = trackSpline.getPointAt(0);
    const startNormal = trackSpline.getNormalAt(0);

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

    // Checkered Finish Line Strip on Asphalt
    const lineGeo = new THREE.PlaneGeometry(trackSpline.data.roadWidth, 2.5);
    const lineMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.6,
      side: THREE.DoubleSide
    });
    const finishLine = new THREE.Mesh(lineGeo, lineMat);
    finishLine.position.copy(startPos);
    finishLine.position.y += 0.08;
    finishLine.rotation.x = -Math.PI / 2;
    finishLine.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, 0));
    finishLine.receiveShadow = true;
    gantry.add(finishLine);

    return gantry;
  }
}
