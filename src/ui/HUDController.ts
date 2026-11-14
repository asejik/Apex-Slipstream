import { VehicleState } from '../engine/VehiclePhysics';
import { CameraMode } from '../engine/CameraController';
import { LapState } from '../engine/LapManager';
import { SurfaceEvaluation } from '../track/TrackSpline';
import { SlipstreamState } from '../engine/SlipstreamManager';
import { TireCompound, getTireCompoundGrip } from '../tires/TireTypes';
import { TrackData } from '../track/TrackDefinitions';
import { DriverFinish, DriverStanding } from '../engine/ChampionshipEngine';
import { QualifyingMode } from '../engine/QualifyingManager';
import { ChampionshipTrophy } from '../engine/SeasonManager';

export class HUDController {
  private speedElement: HTMLElement | null;
  private cameraBadgeElement: HTMLElement | null;
  private rpmBarElement: HTMLElement | null;
  private driftBadgeElement: HTMLElement | null;
  private lapCounterElement: HTMLElement | null;
  private lapTimerElement: HTMLElement | null;
  private bestTimerElement: HTMLElement | null;
  private wrongWayElement: HTMLElement | null;
  private surfaceIndicatorElement: HTMLElement | null;
  private trackNameElement: HTMLElement | null;

  // Milestone 4 Elements
  private audioStatusElement: HTMLElement | null;
  private slipstreamCardElement: HTMLElement | null;
  private slipstreamMeterFillElement: HTMLElement | null;
  private slipstreamDistElement: HTMLElement | null;
  private slipstreamBoostBannerElement: HTMLElement | null;
  private tireGripReadoutElement: HTMLElement | null;
  private tirePills: Map<TireCompound, HTMLElement> = new Map();

  // Milestone 5 Elements
  private racePositionElement: HTMLElement | null;
  private restartTokensBadgeElement: HTMLElement | null;

  // Milestone 6 Elements & Modals
  private seasonRoundBadgeElement: HTMLElement | null;
  private modalQualifying: HTMLElement | null;
  private modalRaceResults: HTMLElement | null;
  private modalStandings: HTMLElement | null;
  private modalPodium: HTMLElement | null;
  private selectedQualifyMode: QualifyingMode = 'flying_lap';

  private onCameraToggleCallback?: () => void;
  private onTrackToggleCallback?: () => void;
  private onAudioToggleCallback?: () => void;
  private onTireSelectCallback?: (compound: TireCompound) => void;
  private onRestartCallback?: () => void;
  private onOpenStandingsCallback?: () => void;
  private onOpenQualifyCallback?: () => void;

  constructor(
    onCameraToggle?: () => void,
    onTrackToggle?: () => void,
    onAudioToggle?: () => void,
    onTireSelect?: (compound: TireCompound) => void,
    onRestart?: () => void,
    onOpenStandings?: () => void,
    onOpenQualify?: () => void
  ) {
    this.onCameraToggleCallback = onCameraToggle;
    this.onTrackToggleCallback = onTrackToggle;
    this.onAudioToggleCallback = onAudioToggle;
    this.onTireSelectCallback = onTireSelect;
    this.onRestartCallback = onRestart;
    this.onOpenStandingsCallback = onOpenStandings;
    this.onOpenQualifyCallback = onOpenQualify;

    this.speedElement = document.getElementById('speed-value');
    this.cameraBadgeElement = document.getElementById('camera-mode-badge');
    this.rpmBarElement = document.getElementById('rpm-bar-fill');
    this.driftBadgeElement = document.getElementById('drift-indicator');
    this.lapCounterElement = document.getElementById('lap-counter-value');
    this.lapTimerElement = document.getElementById('lap-timer-value');
    this.bestTimerElement = document.getElementById('best-timer-value');
    this.wrongWayElement = document.getElementById('wrong-way-indicator');
    this.surfaceIndicatorElement = document.getElementById('surface-indicator');
    this.trackNameElement = document.getElementById('track-name-badge');

    // Milestone 4 UI hooks
    this.audioStatusElement = document.getElementById('audio-status-badge');
    this.slipstreamCardElement = document.getElementById('slipstream-card');
    this.slipstreamMeterFillElement = document.getElementById('slipstream-meter-fill');
    this.slipstreamDistElement = document.getElementById('slipstream-dist');
    this.slipstreamBoostBannerElement = document.getElementById('slipstream-boost-banner');
    this.tireGripReadoutElement = document.getElementById('tire-grip-readout');

    // Milestone 5 UI hooks
    this.racePositionElement = document.getElementById('race-position-value');
    this.restartTokensBadgeElement = document.getElementById('restart-tokens-badge');

    // Milestone 6 UI hooks
    this.seasonRoundBadgeElement = document.getElementById('badge-season-round');
    this.modalQualifying = document.getElementById('modal-qualifying');
    this.modalRaceResults = document.getElementById('modal-race-results');
    this.modalStandings = document.getElementById('modal-standings');
    this.modalPodium = document.getElementById('modal-podium');

    this.bindButtons();
    this.bindQualifyOptions();
  }

  private bindButtons(): void {
    const restartBtn = document.getElementById('btn-restart-race');
    if (restartBtn) {
      restartBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onRestartCallback?.();
      });
    }

    const standingsBtn = document.getElementById('btn-standings-toggle');
    if (standingsBtn) {
      standingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onOpenStandingsCallback?.();
      });
    }

    const qualifyBtn = document.getElementById('btn-qualify-toggle');
    if (qualifyBtn) {
      qualifyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onOpenQualifyCallback?.();
      });
    }

    const streetBtn = document.getElementById('btn-tire-street');
    const allTerrainBtn = document.getElementById('btn-tire-allterrain');
    const wetBtn = document.getElementById('btn-tire-wet');

    if (streetBtn) {
      this.tirePills.set('street', streetBtn);
      streetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onTireSelectCallback?.('street');
      });
    }
    if (allTerrainBtn) {
      this.tirePills.set('all_terrain', allTerrainBtn);
      allTerrainBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onTireSelectCallback?.('all_terrain');
      });
    }
    if (wetBtn) {
      this.tirePills.set('wet', wetBtn);
      wetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onTireSelectCallback?.('wet');
      });
    }

    const audioBtn = document.getElementById('btn-audio-toggle');
    if (audioBtn) {
      audioBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onAudioToggleCallback?.();
      });
    }

    const cameraBtn = document.getElementById('btn-camera-toggle');
    if (cameraBtn) {
      cameraBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onCameraToggleCallback?.();
      });
    }

    const trackBtn = document.getElementById('btn-track-toggle');
    if (trackBtn) {
      trackBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onTrackToggleCallback?.();
      });
    }
  }

  private bindQualifyOptions(): void {
    const cardFlying = document.getElementById('card-mode-flying');
    const cardSector = document.getElementById('card-mode-sector');
    const cardSkip = document.getElementById('card-mode-skip');

    const cards = [
      { el: cardFlying, mode: 'flying_lap' as QualifyingMode },
      { el: cardSector, mode: 'sector_sprint' as QualifyingMode },
      { el: cardSkip, mode: 'skip' as QualifyingMode }
    ];

    cards.forEach(({ el, mode }) => {
      if (el) {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          cards.forEach((c) => c.el?.classList.remove('selected'));
          el.classList.add('selected');
          this.selectedQualifyMode = mode;
        });
      }
    });
  }

  public isAnyModalOpen(): boolean {
    return (
      (this.modalQualifying?.classList.contains('active') ?? false) ||
      (this.modalRaceResults?.classList.contains('active') ?? false) ||
      (this.modalStandings?.classList.contains('active') ?? false) ||
      (this.modalPodium?.classList.contains('active') ?? false)
    );
  }

  public showQualifyingModal(
    track: TrackData,
    onStart: (mode: QualifyingMode) => void
  ): void {
    const titleEl = document.getElementById('qualify-track-name');
    const descEl = document.getElementById('qualify-track-desc');
    if (titleEl) titleEl.textContent = track.name;
    if (descEl) descEl.textContent = `${track.description} · ${track.laps} Laps · ${track.biome.toUpperCase()}`;

    const startBtn = document.getElementById('btn-start-qualifying');
    if (startBtn) {
      // Replace with fresh listener
      const newBtn = startBtn.cloneNode(true) as HTMLElement;
      startBtn.parentNode?.replaceChild(newBtn, startBtn);
      newBtn.addEventListener('click', () => {
        this.hideQualifyingModal();
        onStart(this.selectedQualifyMode);
      });
    }

    this.modalQualifying?.classList.add('active');
  }

  public hideQualifyingModal(): void {
    this.modalQualifying?.classList.remove('active');
  }

  public showResultsModal(
    finishes: DriverFinish[],
    onNextRace: () => void,
    onViewStandings: () => void
  ): void {
    const playerFinish = finishes.find((f) => f.isPlayer);
    const headlineEl = document.getElementById('results-headline');
    const pointsTotalEl = document.getElementById('results-points-total');
    const pointsBreakdownEl = document.getElementById('results-points-breakdown');
    const tbody = document.getElementById('results-table-body');

    if (headlineEl && playerFinish) {
      headlineEl.textContent = `Race Results: P${playerFinish.finishPosition} Finished`;
    }
    if (pointsTotalEl && playerFinish) {
      pointsTotalEl.textContent = `+${playerFinish.totalPoints} PTS`;
    }
    if (pointsBreakdownEl && playerFinish) {
      const parts = [`${playerFinish.basePoints} Base Points`];
      if (playerFinish.hasFastestLap) parts.push('+1 Fastest Lap');
      if (playerFinish.isCleanDriver) parts.push('+2 Clean Driver');
      pointsBreakdownEl.textContent = parts.join(' · ');
    }

    if (tbody) {
      tbody.innerHTML = '';
      // Show top 8 finishers
      const displayFinishes = finishes.slice(0, 8);
      for (const f of displayFinishes) {
        const row = document.createElement('tr');
        if (f.isPlayer) row.classList.add('player-row');

        const rankCell = document.createElement('td');
        const rankPill = document.createElement('span');
        rankPill.className = `rank-pill rank-${f.finishPosition <= 3 ? f.finishPosition : 'other'}`;
        rankPill.textContent = `P${f.finishPosition}`;
        rankCell.appendChild(rankPill);

        const nameCell = document.createElement('td');
        nameCell.textContent = f.driverName;

        const teamCell = document.createElement('td');
        teamCell.textContent = f.team;

        const lapCell = document.createElement('td');
        lapCell.textContent = f.fastestLapMs > 0 ? this.formatTime(f.fastestLapMs / 1000) : '--';

        const ptsCell = document.createElement('td');
        ptsCell.textContent = `+${f.totalPoints}`;

        row.appendChild(rankCell);
        row.appendChild(nameCell);
        row.appendChild(teamCell);
        row.appendChild(lapCell);
        row.appendChild(ptsCell);
        tbody.appendChild(row);
      }
    }

    const nextBtn = document.getElementById('btn-next-race');
    if (nextBtn) {
      const newBtn = nextBtn.cloneNode(true) as HTMLElement;
      nextBtn.parentNode?.replaceChild(newBtn, nextBtn);
      newBtn.addEventListener('click', () => {
        this.hideResultsModal();
        onNextRace();
      });
    }

    const standingsBtn = document.getElementById('btn-view-standings-from-results');
    if (standingsBtn) {
      const newBtn = standingsBtn.cloneNode(true) as HTMLElement;
      standingsBtn.parentNode?.replaceChild(newBtn, standingsBtn);
      newBtn.addEventListener('click', () => {
        this.hideResultsModal();
        onViewStandings();
      });
    }

    this.modalRaceResults?.classList.add('active');
  }

  public hideResultsModal(): void {
    this.modalRaceResults?.classList.remove('active');
  }

  public showStandingsModal(
    standings: DriverStanding[],
    currentRound: number,
    totalRaces: number,
    onClose: () => void
  ): void {
    const progressEl = document.getElementById('standings-season-progress');
    if (progressEl) {
      progressEl.textContent = `Apex World Championship · Round ${currentRound + 1} of ${totalRaces}`;
    }

    const tbody = document.getElementById('standings-table-body');
    if (tbody) {
      tbody.innerHTML = '';
      standings.forEach((s, idx) => {
        const rank = idx + 1;
        const row = document.createElement('tr');
        if (s.isPlayer) row.classList.add('player-row');

        const rankCell = document.createElement('td');
        const pill = document.createElement('span');
        pill.className = `rank-pill rank-${rank <= 3 ? rank : 'other'}`;
        pill.textContent = `${rank}`;
        rankCell.appendChild(pill);

        const nameCell = document.createElement('td');
        nameCell.textContent = s.driverName;

        const teamCell = document.createElement('td');
        teamCell.textContent = s.team;

        const winsCell = document.createElement('td');
        winsCell.textContent = `${s.wins}`;

        const podiumsCell = document.createElement('td');
        podiumsCell.textContent = `${s.podiums}`;

        const pointsCell = document.createElement('td');
        pointsCell.textContent = `${s.points} PTS`;

        row.appendChild(rankCell);
        row.appendChild(nameCell);
        row.appendChild(teamCell);
        row.appendChild(winsCell);
        row.appendChild(podiumsCell);
        row.appendChild(pointsCell);
        tbody.appendChild(row);
      });
    }

    const closeBtn = document.getElementById('btn-close-standings');
    const continueBtn = document.getElementById('btn-continue-from-standings');
    const handleClose = (): void => {
      this.hideStandingsModal();
      onClose();
    };

    if (closeBtn) {
      const newBtn = closeBtn.cloneNode(true) as HTMLElement;
      closeBtn.parentNode?.replaceChild(newBtn, closeBtn);
      newBtn.addEventListener('click', handleClose);
    }
    if (continueBtn) {
      const newBtn = continueBtn.cloneNode(true) as HTMLElement;
      continueBtn.parentNode?.replaceChild(newBtn, continueBtn);
      newBtn.addEventListener('click', handleClose);
    }

    this.modalStandings?.classList.add('active');
  }

  public hideStandingsModal(): void {
    this.modalStandings?.classList.remove('active');
  }

  public showPodiumModal(
    trophy: ChampionshipTrophy,
    onNewSeason: () => void
  ): void {
    const iconEl = document.getElementById('podium-trophy-icon');
    const bannerEl = document.getElementById('podium-banner-text');
    const subEl = document.getElementById('podium-sub-text');

    if (trophy === 'gold') {
      if (iconEl) iconEl.textContent = '🏆';
      if (bannerEl) bannerEl.textContent = 'WORLD CHAMPION!';
      if (subEl) subEl.textContent = '1st Place Gold Trophy! You dominated the season!';
    } else if (trophy === 'silver') {
      if (iconEl) iconEl.textContent = '🥈';
      if (bannerEl) bannerEl.textContent = 'CHAMPIONSHIP RUNNER-UP!';
      if (subEl) subEl.textContent = '2nd Place Silver Trophy! An extraordinary campaign!';
    } else if (trophy === 'bronze') {
      if (iconEl) iconEl.textContent = '🥉';
      if (bannerEl) bannerEl.textContent = 'PODIUM FINISHER!';
      if (subEl) subEl.textContent = '3rd Place Bronze Trophy! Well earned consistency!';
    } else {
      if (iconEl) iconEl.textContent = '🏁';
      if (bannerEl) bannerEl.textContent = 'SEASON COMPLETED!';
      if (subEl) subEl.textContent = 'Full 8-round championship completed! Ready to claim the crown?';
    }

    const btn = document.getElementById('btn-start-new-season');
    if (btn) {
      const newBtn = btn.cloneNode(true) as HTMLElement;
      btn.parentNode?.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', () => {
        this.hidePodiumModal();
        onNewSeason();
      });
    }

    this.modalPodium?.classList.add('active');
  }

  public hidePodiumModal(): void {
    this.modalPodium?.classList.remove('active');
  }

  public update(
    vehicle: VehicleState,
    cameraMode: CameraMode,
    lapState: LapState,
    surface: SurfaceEvaluation,
    trackName: string,
    slipstream: SlipstreamState,
    activeTire: TireCompound,
    isAudioMuted: boolean,
    positionRank = 20,
    tokensRemaining = 3,
    currentRound = 0,
    totalRaces = 8,
    isQualifying = false
  ): void {
    // 1. Speedometer
    if (this.speedElement) {
      this.speedElement.textContent = Math.round(vehicle.speedKmh).toString();
    }

    // 2. RPM Bar Fill
    if (this.rpmBarElement) {
      const percent = Math.min(100, Math.round(vehicle.rpm * 100));
      this.rpmBarElement.style.width = `${percent}%`;
    }

    // 3. Camera Mode Badge
    if (this.cameraBadgeElement) {
      const modeLabel = cameraMode === 'high-chase' ? 'High-Chase'
        : cameraMode === 'low-chase' ? 'Low-Chase'
        : 'Top-Down';
      this.cameraBadgeElement.textContent = `Camera [C]: ${modeLabel}`;
    }

    // 4. Track Name Badge
    if (this.trackNameElement) {
      this.trackNameElement.textContent = `Track [T]: ${trackName}`;
    }

    // 5. Lap & Timers
    if (this.lapCounterElement) {
      if (isQualifying) {
        this.lapCounterElement.textContent = 'QUALIFYING';
      } else if (lapState.isRaceCompleted) {
        this.lapCounterElement.textContent = 'FINISHED';
      } else {
        this.lapCounterElement.textContent = `LAP ${lapState.currentLap}/${lapState.totalLaps}`;
      }
    }

    if (this.lapTimerElement) {
      this.lapTimerElement.textContent = this.formatTime(lapState.currentLapTime);
    }

    if (this.bestTimerElement) {
      if (lapState.bestLapTime !== null) {
        this.bestTimerElement.textContent = `BEST: ${this.formatTime(lapState.bestLapTime)}`;
      } else {
        this.bestTimerElement.textContent = 'BEST: --:--.--';
      }
    }

    // 6. Surface Indicator (Asphalt / Curb / Off-road Gravel)
    if (this.surfaceIndicatorElement) {
      if (surface.surface === 'gravel') {
        this.surfaceIndicatorElement.textContent = '⚠️ OFF-ROAD (GRAVEL)';
        this.surfaceIndicatorElement.style.color = '#eab308';
        this.surfaceIndicatorElement.style.opacity = '1.0';
      } else if (surface.surface === 'curb') {
        this.surfaceIndicatorElement.textContent = 'CURB';
        this.surfaceIndicatorElement.style.color = '#00f0ff';
        this.surfaceIndicatorElement.style.opacity = '0.8';
      } else {
        this.surfaceIndicatorElement.style.opacity = '0.0';
      }
    }

    // 7. Wrong Way Warning
    if (this.wrongWayElement) {
      this.wrongWayElement.style.opacity = lapState.wrongWay ? '1.0' : '0.0';
    }

    // 8. Drift indicator
    if (this.driftBadgeElement) {
      if (vehicle.driftFactor > 0.35 && vehicle.speedKmh > 20) {
        this.driftBadgeElement.style.opacity = '1.0';
        this.driftBadgeElement.style.transform = 'scale(1.05)';
      } else {
        this.driftBadgeElement.style.opacity = '0.0';
        this.driftBadgeElement.style.transform = 'scale(0.9)';
      }
    }

    // 9. Slipstream Drafting Card
    if (this.slipstreamCardElement) {
      const showCard = slipstream.inWake || slipstream.isBoostActive;
      if (showCard) {
        this.slipstreamCardElement.classList.add('visible');
      } else {
        this.slipstreamCardElement.classList.remove('visible');
      }

      if (this.slipstreamMeterFillElement) {
        const percent = slipstream.isBoostActive ? 100 : Math.round(slipstream.draftProgress * 100);
        this.slipstreamMeterFillElement.style.width = `${percent}%`;
      }

      if (this.slipstreamDistElement) {
        if (slipstream.distanceToLead < 100) {
          this.slipstreamDistElement.textContent = `${slipstream.distanceToLead.toFixed(1)}m`;
        } else {
          this.slipstreamDistElement.textContent = '--';
        }
      }

      if (this.slipstreamBoostBannerElement) {
        this.slipstreamBoostBannerElement.style.display = slipstream.isBoostActive ? 'block' : 'none';
      }
    }

    // 10. Tactical Tires Active Pill & Grip Readout
    this.tirePills.forEach((el, compound) => {
      if (compound === activeTire) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    if (this.tireGripReadoutElement) {
      const effectiveGrip = getTireCompoundGrip(activeTire, surface.surface);
      const gripPercent = Math.round(effectiveGrip * 100);
      this.tireGripReadoutElement.textContent = `GRIP: ${gripPercent}%`;
    }

    // 11. Audio Status
    if (this.audioStatusElement) {
      this.audioStatusElement.textContent = isAudioMuted
        ? 'Audio [M]: 🔇 MUTED'
        : 'Audio [M]: 🔊 UNMUTED';
    }

    // 12. Race Position & Restart Tokens
    if (this.racePositionElement) {
      this.racePositionElement.textContent = isQualifying
        ? 'QUALIFYING'
        : `P${positionRank} / 20`;
    }
    if (this.restartTokensBadgeElement) {
      this.restartTokensBadgeElement.textContent = `Restart [R]: ${tokensRemaining} Tokens 🪙`;
    }
    if (this.seasonRoundBadgeElement) {
      this.seasonRoundBadgeElement.textContent = `Season Round ${currentRound + 1} of ${totalRaces}`;
    }
  }

  private formatTime(totalSeconds: number): string {
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    const ms = Math.floor((totalSeconds * 100) % 100);

    const mm = mins.toString().padStart(2, '0');
    const ss = secs.toString().padStart(2, '0');
    const xx = ms.toString().padStart(2, '0');
    return `${mm}:${ss}.${xx}`;
  }
}
