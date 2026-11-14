import * as THREE from 'three';
import { VehiclePhysics } from './VehiclePhysics';
import { AICarState } from '../ai/AIDriverManager';

export interface CollisionEvent {
  type: 'glance' | 'severe';
  impactSpeedKmh: number;
  contactPoint: THREE.Vector3;
}

export class CollisionManager {
  private static readonly CAR_COLLISION_RADIUS = 2.2; // meters
  private static readonly SEVERE_IMPACT_THRESHOLD_KMH = 55.0;

  // Scratch objects for zero heap allocations in 60Hz loop
  private readonly _scratchDiff = new THREE.Vector3();
  private readonly _scratchRelVel = new THREE.Vector3();

  /**
   * Evaluates and resolves collisions between the player car and all 19 AI cars.
   * Also resolves inter-AI collisions.
   */
  public resolveCollisions(
    player: VehiclePhysics,
    aiCars: AICarState[]
  ): CollisionEvent | null {
    let playerEvent: CollisionEvent | null = null;
    const playerPos = player.state.position;
    const playerVel = player.state.velocity;

    // 1. Player vs AI Cars
    for (let i = 0; i < aiCars.length; i++) {
      const ai = aiCars[i];
      if (!ai || ai.isSpinningOut || ai.finishTime !== null) continue;

      this._scratchDiff.subVectors(playerPos, ai.position);
      // Project to XZ ground plane for bounding cylinder test
      const distSq = this._scratchDiff.x * this._scratchDiff.x + this._scratchDiff.z * this._scratchDiff.z;
      const minDist = CollisionManager.CAR_COLLISION_RADIUS;

      if (distSq < minDist * minDist && distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        const overlap = minDist - dist;

        // Collision normal from AI to Player
        const nx = this._scratchDiff.x / dist;
        const nz = this._scratchDiff.z / dist;

        // Separate player and AI positions
        playerPos.x += nx * (overlap * 0.55);
        playerPos.z += nz * (overlap * 0.55);
        ai.position.x -= nx * (overlap * 0.45);
        ai.position.z -= nz * (overlap * 0.45);

        // Compute relative impact speed (Three.js coords: -Z is forward)
        const aiForwardX = (-Math.sin(ai.heading) * ai.speedKmh) / 3.6;
        const aiForwardZ = (-Math.cos(ai.heading) * ai.speedKmh) / 3.6;
        this._scratchRelVel.set(
          playerVel.x - aiForwardX,
          0,
          playerVel.z - aiForwardZ
        );
        const impactSpeedKmh = this._scratchRelVel.length() * 3.6;

        if (impactSpeedKmh >= CollisionManager.SEVERE_IMPACT_THRESHOLD_KMH) {
          // Severe collision: spin out the AI car or penalize speed
          ai.isSpinningOut = true;
          ai.spinTimer = 3.0;
          player.state.velocity.multiplyScalar(0.7); // Scrub 30% speed

          playerEvent = {
            type: 'severe',
            impactSpeedKmh,
            contactPoint: playerPos.clone()
          };
        } else {
          // Glancing bounce: elastic restitution
          const bounceImpulse = 4.5;
          player.state.velocity.x += nx * bounceImpulse;
          player.state.velocity.z += nz * bounceImpulse;
          player.state.velocity.multiplyScalar(0.95); // Minor 5% scrub

          if (!playerEvent) {
            playerEvent = {
              type: 'glance',
              impactSpeedKmh,
              contactPoint: playerPos.clone()
            };
          }
        }
      }
    }

    // 2. AI vs AI Contacts (Light elastic separation)
    for (let i = 0; i < aiCars.length; i++) {
      const carA = aiCars[i];
      if (!carA || carA.isSpinningOut || carA.finishTime !== null) continue;

      for (let j = i + 1; j < aiCars.length; j++) {
        const carB = aiCars[j];
        if (!carB || carB.isSpinningOut || carB.finishTime !== null) continue;

        this._scratchDiff.subVectors(carA.position, carB.position);
        const distSq = this._scratchDiff.x * this._scratchDiff.x + this._scratchDiff.z * this._scratchDiff.z;
        const minDist = CollisionManager.CAR_COLLISION_RADIUS;

        if (distSq < minDist * minDist && distSq > 0.0001) {
          const dist = Math.sqrt(distSq);
          const overlap = minDist - dist;
          const nx = this._scratchDiff.x / dist;
          const nz = this._scratchDiff.z / dist;

          carA.position.x += nx * (overlap * 0.5);
          carA.position.z += nz * (overlap * 0.5);
          carB.position.x -= nx * (overlap * 0.5);
          carB.position.z -= nz * (overlap * 0.5);
        }
      }
    }

    return playerEvent;
  }
}
