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
  private static readonly MAX_SHOVE_MS = 6.0; // m/s added to the player when an AI hits them

  // Scratch objects for zero heap allocations in 60Hz loop
  private readonly _scratchDiff = new THREE.Vector3();
  private readonly _contactPoint = new THREE.Vector3();

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
      if (!ai || ai.isSpinningOut || ai.isParked) continue;

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
        // Impact speed is how fast the cars close on each other along the line between
        // them (U-05). Rubbing doors at different speeds is not a crash.
        const playerToward = -(playerVel.x * nx + playerVel.z * nz);
        const aiToward = aiForwardX * nx + aiForwardZ * nz;
        const impactSpeedKmh = Math.max(0, playerToward + aiToward) * 3.6;
        const isSevere = impactSpeedKmh >= CollisionManager.SEVERE_IMPACT_THRESHOLD_KMH;

        if (isSevere && aiToward > playerToward) {
          // The AI ran into the player: it brakes, the player is shoved, nobody spins
          // and the player is not blamed
          const shove = Math.min(CollisionManager.MAX_SHOVE_MS, (impactSpeedKmh / 3.6) * 0.3);
          player.state.velocity.x += nx * shove;
          player.state.velocity.z += nz * shove;
          ai.speedKmh *= 0.5;

          if (!playerEvent) {
            playerEvent = {
              type: 'glance',
              impactSpeedKmh,
              contactPoint: this._contactPoint.copy(playerPos)
            };
          }
        } else if (isSevere) {
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
      if (!carA || carA.isSpinningOut || carA.isParked) continue;

      for (let j = i + 1; j < aiCars.length; j++) {
        const carB = aiCars[j];
        if (!carB || carB.isSpinningOut || carB.isParked) continue;

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
