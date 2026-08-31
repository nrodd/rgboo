import type { Meta, StoryObj } from "@storybook/react";

import { Container } from "../components/common";

const meta = {
  title: "Layout/Container",
  component: Container,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {},
} satisfies Meta<typeof Container>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: "a comfortable amount of privacy",
  },
};

export const Thick: Story = {
  args: {
    children: "you can hardly see through me",
    variant: "thick",
  },
};

export const Thin: Story = {
  args: {
    children: "ok pervert that's enough",
    variant: "thin",
  },
};

export const ClassOverrides: Story = {
  args: {
    children: "I can override the class styles",
    className: "rounded-full w-80 align-left",
  },
};
