import React from "react";
import { fitSize, useEnter, type Box, type SceneData, type VideoProps } from "../theme";

export const Quote: React.FC<{ s: SceneData; p: VideoProps; box: Box }> = ({ s, p, box }) => {
  const { theme, motion } = p;
  const a = useEnter(4, motion.damping);
  const b = useEnter(20, motion.damping);
  const q = s.quote ?? "";
  const size = fitSize(q, box.cw - 40, box.ch * 0.62, 78, 30, 1.25);
  return (
    <div>
      <div style={{ fontSize: 220, lineHeight: 0.6, color: theme.accent, fontWeight: 900, height: 110, opacity: a }}>“</div>
      <div style={{ fontSize: size, lineHeight: 1.25, fontWeight: 600, fontStyle: "italic", opacity: a, transform: `translateY(${(1 - a) * motion.travel}px)` }}>{q}</div>
      {s.attribution ? (
        <div style={{ marginTop: 32, fontSize: 38, color: theme.muted, fontWeight: 600, opacity: b }}>— {s.attribution}</div>
      ) : null}
    </div>
  );
};
