import type { Meta, StoryObj } from "@storybook/react";

import { IconButton } from "../components/common";
import InfoIcon from "../assets/info.svg?react";

const meta = {
  title: "Input/IconButton",
  component: IconButton,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    icon: <InfoIcon />,
    label: "default",
  },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: "default",
    onClick: () => alert("👻"),
  },
};

export const Disabled: Story = {
  args: {
    label: "disabled",
    disabled: true,
  },
};

export const GlassControl: Story = {
  render: (args) => (
    <div className="flex flex-row gap-10">
      <IconButton {...args} label="default" variant="default" />
      <IconButton {...args} label="thick" variant="thick" />
      <IconButton {...args} label="thin" variant="thin" />
    </div>
  ),
};
