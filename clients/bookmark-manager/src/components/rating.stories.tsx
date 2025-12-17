import type { Meta, StoryObj } from "@storybook/react-vite";

import { CustomStarIcon, Rating } from "./rating";
import { useState } from "react";
import { cn } from "@design-system/lib/utils";
import { Star } from "lucide-react";

const meta = {
  title: "Rating",
  component: Rating,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Rating>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary = {
  render: () => {
    const [rating, setRating] = useState(3);

    return (
      <Rating
        rating={rating}
        setRating={setRating}
      />
    );
  },
};
