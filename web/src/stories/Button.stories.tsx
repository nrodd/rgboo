import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "../components/common";

const meta = {
  title: "Input/Button",
  component: Button,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: { label: "Submit" },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onClick: () => alert("Boo!"),
  },
};

export const Disabled: Story = {
  args: {
    label: "I'm in timeout",
    disabled: true,
  },
};

export const FullWidth: Story = {
  render: (args) => (
    <div className="w-80 background-arcana-400">
      <Button {...args} fullWidth label="meep" />
    </div>
  ),
};

export const GlassControl: Story = {
  render: (args) => (
    <div className="flex flex-row gap-10">
      <Button {...args} fullWidth label="default" variant="default" />
      <Button {...args} fullWidth label="thick" variant="thick" />
      <Button {...args} fullWidth label="thin" variant="thin" />
    </div>
  ),
};
