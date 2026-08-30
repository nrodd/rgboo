import type { Meta, StoryObj } from "@storybook/react";

import { Button, Drawer } from "../components/common";
import { useState } from "react";

const meta = {
  title: "Layout/Drawer",
  component: Drawer,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    onClose: () => {},
    open: false,
  },
} satisfies Meta<typeof Drawer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => {
    const [open, setOpen] = useState(false);
    return (
      <div className="w-200 h-90 flex items-center justify-center">
        <Button onClick={() => setOpen(true)} label="Open" />
        <Drawer {...args} open={open} onClose={() => setOpen(false)}>
          <p>Oh cool, it's a drawer!</p>
        </Drawer>
      </div>
    );
  },
};
