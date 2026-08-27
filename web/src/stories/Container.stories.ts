import type { Meta, StoryObj } from "@storybook/react";

import { Container } from "../components/common";

const meta = {
  title: "Layout/Container",
  component: Container,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {},
  args: {},
} satisfies Meta<typeof Container>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: "something",
  },
};
