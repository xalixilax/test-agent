import { Button } from "@design-system/ui/button";
import { Star } from "lucide-react";
import { useState } from "react";

export function Rating({
  rating,
  setRating,
}: {
  rating: number | null;
  setRating: (rating: number) => void;
}) {
  const [currentRating, setCurrentRating] = useState(rating || 0);
  const [hoverRating, setHoverRating] = useState(0);

  const getStarState = (
    star: number
  ): "filled" | "lighter" | "grey" | "unfilled" => {
    if (hoverRating > 0) {
      if (star <= hoverRating) {
        // Hovering on this star or before
        if (star <= currentRating) {
          // This star is filled and we're hovering on or before it
          return "filled";
        } else {
          // This star is unfilled and we're hovering on it
          return "grey";
        }
      } else {
        // Not hovering on this star (beyond hover point)
        if (star <= currentRating) {
          // This star is filled but we're hovering before it
          return "lighter";
        } else {
          return "unfilled";
        }
      }
    }
    // No hover - just show current rating
    return star <= currentRating ? "filled" : "unfilled";
  };

  return (
    <div className="flex flex-row gap-1" onMouseLeave={() => setHoverRating(0)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          className="size-8 relative"
          key={star}
          onClick={(e) => {
            e.stopPropagation();
            setCurrentRating(star);
            setRating(star);
          }}
          onMouseEnter={() => setHoverRating(star)}
          title={`${star} star${star > 1 ? "s" : ""}`}
        >
          <CustomStarIcon state={getStarState(star)} />
        </button>
      ))}
    </div>
  );
}

export function CustomStarIcon({
  state = "unfilled",
}: {
  state?: "filled" | "lighter" | "grey" | "unfilled";
}) {
  const fillColor = {
    filled: "fill-[#F4D738]",
    lighter: "fill-[#FDFD96]",
    grey: "fill-[#F4D738]",
    unfilled: "fill-white",
  }[state];

  return (
    <>
      <Star
        className={`z-5 top-0 absolute size-8 active:translate-0.5 hover:-translate-0.5 stroke-foreground transition-all duration-100 ${fillColor}`}
        strokeWidth={2}
      />
      <Star className="absolute top-0 size-8 fill-foreground translate-1" />
    </>
  );
}
