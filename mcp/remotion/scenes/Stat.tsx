import React from "react";
import { fitSize, useEnter, type Box, type SceneData, type VideoProps } from "../theme";

export const Stat: React.FC<{ s: SceneData; p: VideoProps; box: Box }> = ({ s, p, box }) => {
  const { theme, motion } = p;
  const a = useEnter(4, motion.damping);
  const b = useEnter(16, motion.damping);
  const value = s.value ?? "";
  const size = fitSize(value, box.cw, box.ch * 0.5, 300, 60, 1);
  return (
    <div style={{ textAlign: box.vertical ? "left" : "center" }}>
      {s.heading ? <div style={{ fontSize: 40, color: theme.muted, fontWeight: 600, marginBottom: 12, opacity: a }}>{s.heading}</div> : null}
      <div
        style={{
          fontSize: size, lineHeight: 1, fontWeight: 900, color: theme.accent, letterSpacing: -4, opacity: a,
          transform: `scale(${0.85 + 0.15 * a})`, transformOrigin: box.vertical ? "left center" : "center",
        }}
      >
        {value}
      </div>
      <div
        style={{
          width: 160 * b, height: 8, borderRadius: 6, background: theme.accent, margin: box.vertical ? "30px 0" : "30px auto",
        }}
      />
      <div style={{ fontSize: fitSize(s.label ?? "", box.cw, box.ch * 0.3, 60, 28, 1.2), fontWeight: 600, opacity: b, transform: `translateY(${(1 - b) * motion.travel * 0.5}px)` }}>
        {s.label}
      </div>
    </div>
  );
};
