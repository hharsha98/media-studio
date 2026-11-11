import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { Audio } from "@remotion/media";
import { staticFile } from "remotion";
import { rgba, fitSize, type Box, type SceneData, type VideoProps } from "./theme";

/** Shared chrome: background, transition in/out, voice audio, AI-voice label and captions. */
export const SceneFrame: React.FC<{ scene: SceneData; props: VideoProps; box: Box; children: React.ReactNode }> = ({ scene, props, box, children }) => {
  const frame = useCurrentFrame();
  const { theme, motion } = props;
  const T = motion.transitionFrames;
  const dur = scene.durationFrames;
  const inP = interpolate(frame, [0, T], [0, 1], { extrapolateRight: "clamp" });
  const outP = interpolate(frame, [dur - T, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const p = Math.min(inP, outP);
  const slide = (1 - inP) * 60 - (1 - outP) * 60;
  const transform =
    motion.transition === "slide" ? `translateX(${slide}px)` : motion.transition === "zoom" ? `scale(${0.96 + 0.04 * p})` : "none";

  const capBottom = box.vertical ? 330 : 64;
  const page = scene.captions.find((c) => frame >= c.from && frame < c.to);
  const capW = box.w * 0.9;
  const longest = page ? Math.max(...page.lines.map((l) => l.length)) : 1;
  const capSize = Math.min(box.vertical ? 50 : 46, Math.max(28, Math.floor(capW / (0.58 * longest + 0.0001) - 1)));
  const contentBottom = box.bottom;

  return (
    <AbsoluteFill style={{ backgroundColor: theme.background, fontFamily: theme.font, color: theme.foreground }}>
      <AbsoluteFill style={{ background: `radial-gradient(1200px 700px at 85% 0%, ${rgba(theme.accent, 0.16)}, transparent 70%)` }} />
      <AbsoluteFill style={{ opacity: p, transform }}>
        <div
          style={{
            position: "absolute", left: box.pad, right: box.pad, top: 130, bottom: contentBottom,
            display: "flex", flexDirection: "column", justifyContent: "center",
          }}
        >
          {children}
        </div>
        {props.labels.aiVoice && scene.audio ? (
          <div
            style={{
              position: "absolute", top: 40, right: 48, fontSize: 22, letterSpacing: 1, padding: "6px 14px", borderRadius: 999,
              color: theme.muted, border: `1.5px solid ${rgba(theme.muted, 0.6)}`,
            }}
          >
            AI voice
          </div>
        ) : null}
        {scene.sourceTag ? (
          <div style={{ position: "absolute", left: box.pad, bottom: contentBottom - 56, fontSize: 24, color: theme.muted, maxWidth: box.w - 2 * box.pad }}>
            {scene.sourceTag}
          </div>
        ) : null}
        {page ? (
          <div
            style={{
              position: "absolute", left: 0, right: 0, bottom: capBottom, display: "flex", justifyContent: "center", padding: "0 5%",
            }}
          >
            <div
              style={{
                background: "rgba(8, 10, 16, 0.78)", color: "#fff", borderRadius: 18, padding: "14px 28px", textAlign: "center",
                fontSize: capSize, lineHeight: 1.25, fontWeight: 600, maxWidth: "100%",
              }}
            >
              {page.lines.map((l, i) => (
                <div key={i} style={{ whiteSpace: "nowrap" }}>{l}</div>
              ))}
            </div>
          </div>
        ) : null}
      </AbsoluteFill>
      {scene.audio ? (
        <Sequence from={scene.leadFrames}>
          <Audio src={staticFile(scene.audio)} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
};

export const contentBox = (props: VideoProps): Box => {
  const vertical = props.height > props.width;
  const pad = vertical ? 80 : props.format === "1:1" ? 100 : 140;
  const bottom = vertical ? 600 : props.format === "1:1" ? 290 : 260;
  return { w: props.width, h: props.height, vertical, pad, bottom, cw: props.width - 2 * pad, ch: props.height - 130 - bottom };
};
export { fitSize };
