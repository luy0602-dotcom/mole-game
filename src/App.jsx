import { useEffect, useMemo, useRef, useState } from "react";
import MoleGrid from "./components/MoleGrid";
import Hammer from "./components/Hammer";
import { AudioManager, BPM, STEP_MS, DRUM_PARTS } from "./AudioManager";
import { useHandTracker } from "./HandTracker";

const BAND_MEMBERS = [
  { id: "vocal", label: "Vocal", icon: "🎤", color: "var(--vocal)" },
  { id: "guitar", label: "Electric Guitar", icon: "🎸", color: "var(--guitar)" },
  { id: "piano", label: "Piano", icon: "🎹", color: "var(--piano)" },
  { id: "bass", label: "Bass", icon: "🎸", color: "var(--bass)" },
];

const RHYTHM_SEQUENCE = [
  ["crash", "bass"],
  ["hihat"],
  ["snare"],
  ["ride"],
  ["cymbal", "midTom"],
  ["hihat"],
  ["floorTom"],
  ["bass"],
  ["crash", "snare"],
  ["ride"],
  ["hihat", "midTom"],
  ["bass"],
  ["cymbal"],
  ["snare"],
  ["floorTom", "ride"],
  ["hihat"],
];

const POP_VISIBLE_MS = STEP_MS * 1.85;

function createInitialMoles() {
  return DRUM_PARTS.map((part) => ({
    ...part,
    state: "hidden",
    activeAt: 0,
    expiresAt: 0,
    hitAt: 0,
    impact: 0,
  }));
}

export default function App() {
  const audioManagerRef = useRef(null);
  const rafRef = useRef(0);
  const startTimeRef = useRef(0);
  const lastStepRef = useRef(-1);
  const moleRefs = useRef({});
  const processedHitTicksRef = useRef({ left: 0, right: 0 });
  const [started, setStarted] = useState(false);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bpmPulse, setBpmPulse] = useState(0);
  const [statusText, setStatusText] = useState("카메라를 허용하고 공연을 시작해 주세요.");
  const [moles, setMoles] = useState(createInitialMoles);
  const [lastHit, setLastHit] = useState(null);
  const { videoRef, permission, hands } = useHandTracker({ enabled: started });

  if (!audioManagerRef.current) {
    audioManagerRef.current = new AudioManager();
  }

  const bpmLabel = useMemo(() => `${BPM} BPM`, []);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      audioManagerRef.current.stop();
    };
  }, []);

  useEffect(() => {
    if (!started) return undefined;

    startTimeRef.current = performance.now();
    lastStepRef.current = -1;

    const tick = (now) => {
      const elapsed = now - startTimeRef.current;
      const step = Math.floor(elapsed / STEP_MS);

      if (step !== lastStepRef.current) {
        lastStepRef.current = step;
        const sequence = RHYTHM_SEQUENCE[step % RHYTHM_SEQUENCE.length];

        setBpmPulse(step);
        setMoles((prev) =>
          prev.map((mole) => {
            if (sequence.includes(mole.id)) {
              return {
                ...mole,
                state: "up",
                activeAt: now,
                expiresAt: now + POP_VISIBLE_MS,
                hitAt: 0,
                impact: Math.random(),
              };
            }

            if (mole.state === "up" && now > mole.expiresAt) {
              return { ...mole, state: "hidden" };
            }

            return mole;
          }),
        );
      }

      setMoles((prev) =>
        prev.map((mole) => {
          if (mole.state === "hit" && now - mole.hitAt > 190) {
            return { ...mole, state: "hidden" };
          }
          if (mole.state === "up" && now > mole.expiresAt) {
            return { ...mole, state: "hidden" };
          }
          return mole;
        }),
      );

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafRef.current);
  }, [started]);

  useEffect(() => {
    if (!started) return;

    const triggeredHands = hands.filter(
      (hand) => hand.hit && hand.hitTick > (processedHitTicksRef.current[hand.id] || 0),
    );

    if (!triggeredHands.length) return;

    triggeredHands.forEach((hand) => {
      processedHitTicksRef.current[hand.id] = hand.hitTick;
    });

    const hitIds = new Set();
    let nextCombo = combo;
    let scoreGain = 0;
    let successfulHits = 0;
    let latestHit = null;

    triggeredHands.forEach((hand) => {
      const hammerPoint = {
        x: hand.x * window.innerWidth,
        y: hand.y * window.innerHeight,
      };

      const activeMole = moles.find((mole) => {
        if (mole.state !== "up" || hitIds.has(mole.id)) return false;
        const element = moleRefs.current[mole.id];
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const paddingX = rect.width * 0.02;
        const paddingY = rect.height * 0.02;

        return (
          hammerPoint.x >= rect.left + paddingX &&
          hammerPoint.x <= rect.right - paddingX &&
          hammerPoint.y >= rect.top + paddingY &&
          hammerPoint.y <= rect.bottom - paddingY
        );
      });

      if (!activeMole) return;

      const timingOffset = Math.abs((activeMole.activeAt + POP_VISIBLE_MS * 0.52) - performance.now());
      const quality = timingOffset < 90 ? "Perfect" : timingOffset < 170 ? "Great" : "Good";
      const points = quality === "Perfect" ? 160 : quality === "Great" ? 110 : 70;

      hitIds.add(activeMole.id);
      audioManagerRef.current.playDrum(activeMole.id);
      scoreGain += points + nextCombo * 8;
      nextCombo += 1;
      successfulHits += 1;
      latestHit = { id: activeMole.id, quality, handId: hand.id };
    });

    if (!successfulHits) {
      setCombo(0);
      setStatusText("주먹을 쥔 채 손을 휘두르면 망치가 움직여요. 망치가 두더지에 닿게 해보세요.");
      return;
    }

    setMoles((prev) =>
      prev.map((mole) =>
        hitIds.has(mole.id)
          ? {
              ...mole,
              state: "hit",
              hitAt: performance.now(),
            }
          : mole,
      ),
    );
    setScore((prev) => prev + scoreGain);
    setCombo(nextCombo);
    setLastHit(latestHit);
    setStatusText(
      latestHit
        ? `${latestHit.handId === "left" ? "왼손" : "오른손"} ${latestHit.quality}! 주먹을 휘둘러 망치를 두더지에 닿게 하세요.`
        : "두더지 사운드가 밴드에 합류했어요.",
    );
  }, [hands, moles, started, combo]);

  const handleStart = async () => {
    await audioManagerRef.current.start();
    setStarted(true);
    setStatusText("주먹을 인식하면 망치가 따라오고, 주먹을 휘둘러 망치를 두더지에 닿게 하면 타격돼요.");
  };

  const handleStop = () => {
    cancelAnimationFrame(rafRef.current);
    audioManagerRef.current.stop();
    lastStepRef.current = -1;
    setStarted(false);
    processedHitTicksRef.current = { left: 0, right: 0 };
    setCombo(0);
    setBpmPulse(0);
    setLastHit(null);
    setMoles(createInitialMoles());
    setStatusText("공연이 멈췄어요. 다시 시작해서 밴드를 이어가 보세요.");
  };

  const beatProgress = started
    ? ((performance.now() - startTimeRef.current) % (STEP_MS * 4)) / (STEP_MS * 4)
    : 0;

  const bandMembersMarkup = (
    <div className="band-members">
      {BAND_MEMBERS.map((member, index) => (
        <article
          className={`band-card band-${member.id}`}
          key={member.id}
          style={{
            "--accent-color": member.color,
            "--beat-delay": `${index * 120}ms`,
            "--beat-scale": 1 + ((bpmPulse + index) % 2) * 0.06,
          }}
        >
          <div className="band-spotlight" />
          <div className="band-rock" />
          {started ? (
            <div className="band-notes" aria-hidden="true">
              <span className="note note-a">♪</span>
              <span className="note note-b">♫</span>
              <span className="note note-c">♪</span>
            </div>
          ) : null}
          <div className="band-mole">
            <div className="band-mole-top">
              <span className="band-plane plane-left" />
              <span className="band-plane plane-center" />
              <span className="band-plane plane-right" />
            </div>
            <div className="band-ear ear-left" />
            <div className="band-ear ear-right" />
            <div className="band-snout">
              <span className="band-nose" />
            </div>
            <div className="band-blush blush-left" />
            <div className="band-blush blush-right" />
            <div className="band-face">
              <span className="band-eye" />
              <span className="band-eye" />
              <i className="band-whisker whisker-left" />
              <i className="band-whisker whisker-right" />
            </div>
            <strong>{member.icon}</strong>
          </div>
          <h2>{member.label}</h2>
        </article>
      ))}
    </div>
  );

  return (
    <div className="app-shell">
      <div className="terrain terrain-left" />
      <div className="terrain terrain-right" />
      <div className="farm-fence fence-top" />
      <div className="farm-fence fence-bottom" />
      <div className="farm-grass grass-top-left" />
      <div className="farm-grass grass-top-right" />
      <div className="pixel-drum pixel-drum-left" aria-hidden="true">
        <span className="drum-cymbal drum-cymbal-left-top" />
        <span className="drum-cymbal drum-cymbal-left-mid" />
        <span className="drum-tom drum-tom-left" />
        <span className="drum-floor drum-floor-left" />
        <span className="drum-bass" />
        <span className="drum-stand drum-stand-left" />
      </div>
      <div className="pixel-drum pixel-drum-right" aria-hidden="true">
        <span className="drum-cymbal drum-cymbal-right-top" />
        <span className="drum-cymbal drum-cymbal-right-mid" />
        <span className="drum-tom drum-tom-right" />
        <span className="drum-floor drum-floor-right" />
        <span className="drum-bass" />
        <span className="drum-stand drum-stand-right" />
      </div>

      <section className="top-band">
        <div className="title-block">
          <div className="title-gem" />
          <p className="eyebrow">MOLE DRUM BAND</p>
          <h1>
            두더지 밴드의
            <br />
            드러머는 당신
          </h1>
          <p className="lead">
            상단에서는 기타, 피아노, 베이스 두더지가 루프를 연주하고,
            <br />
            하단에서는 8개의 드럼 두더지를 주먹 망치로 콩 찍어 밴드를 완성합니다.
          </p>
        </div>

        <aside className="camera-panel camera-panel-top">
          <div className="camera-frame">
            <video ref={videoRef} autoPlay muted playsInline />
            <div className={`camera-overlay permission-${permission}`}>
              <p>
                {permission === "granted"
                  ? "Camera On"
                  : permission === "denied"
                    ? "Camera Blocked"
                    : "Camera Preview"}
              </p>
              <span>양손 주먹 인식 기반 플레이를 시뮬레이션하며 마우스와 Space로도 바로 테스트할 수 있어요.</span>
            </div>
   