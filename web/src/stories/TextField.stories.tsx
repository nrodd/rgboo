import type { Meta, StoryObj } from "@storybook/react";

import { TextField } from "../components/common";
import { Form, Formik } from "formik";
import { PropsWithChildren } from "react";

const meta = {
  title: "Input/TextField",
  component: TextField,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {},
} satisfies Meta<typeof TextField>;

export default meta;
type Story = StoryObj<typeof meta>;

const StorySetup = ({
  children,
  name = "",
}: PropsWithChildren<{ name?: string }>) => (
  <Formik
    initialValues={{ name }}
    onSubmit={(values) => alert(JSON.stringify(values, null, 2))}
  >
    <Form>{children}</Form>
  </Formik>
);

export const Default: Story = {
  render: (args) => (
    <StorySetup>
      <TextField
        {...args}
        name="name"
        label="Full Name"
        placeholder="Placeholder"
      />
    </StorySetup>
  ),
};

export const Empty: Story = {
  render: (args) => (
    <StorySetup>
      <TextField {...args} name="name" />
    </StorySetup>
  ),
};

export const Placeholder: Story = {
  render: (args) => (
    <StorySetup>
      <TextField {...args} name="name" placeholder="Placeholder" />
    </StorySetup>
  ),
};

export const Filled: Story = {
  render: (args) => (
    <StorySetup name="Jack Skellington">
      <TextField {...args} name="name" />
    </StorySetup>
  ),
};

export const Disabled: Story = {
  render: (args) => (
    <StorySetup name="Jack Skellington">
      <TextField {...args} name="name" disabled />
    </StorySetup>
  ),
};

export const Labeled: Story = {
  render: (args) => (
    <StorySetup name="Jack Skellington">
      <TextField {...args} name="name" label="Full Name" />
    </StorySetup>
  ),
};
