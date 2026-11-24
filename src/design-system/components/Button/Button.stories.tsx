import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { ArrowRight, Plus, Trash2 } from "lucide-react";
import { Button } from "./Button";

const meta = {
  title: "Design System/Button",
  component: Button,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Precision tooling control: 1px border, 6px radius, no shadow or gradient. " +
          "`primary` is the single accent action per surface; `danger` is reserved for destructive confirmations.",
      },
    },
  },
  args: { onClick: fn(), children: "Deploy workflow" },
  argTypes: {
    variant: { control: "inline-radio", options: ["primary", "secondary", "ghost", "danger"] },
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
    loading: { control: "boolean" },
    disabled: { control: "boolean" },
    fullWidth: { control: "boolean" },
  },
  decorators: [
    (Story) => (
      <div className="bg-bg-panel p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: { variant: "primary" },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "Deploy workflow" });
    await expect(button).toBeEnabled();
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalledTimes(1);
  },
};

export const Secondary: Story = { args: { variant: "secondary" } };

export const Ghost: Story = {
  args: { variant: "ghost", children: "Cancel" },
};

export const Danger: Story = {
  args: { variant: "danger", children: "Delete node", leadingIcon: <Trash2 size={14} strokeWidth={1.5} /> },
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex items-center gap-3">
      <Button {...args} size="sm" variant="primary">
        Small
      </Button>
      <Button {...args} size="md" variant="primary">
        Medium
      </Button>
      <Button {...args} size="lg" variant="primary">
        Large
      </Button>
    </div>
  ),
};

export const WithIcons: Story = {
  render: (args) => (
    <div className="flex items-center gap-3">
      <Button {...args} variant="primary" leadingIcon={<Plus size={14} strokeWidth={1.5} />}>
        New node
      </Button>
      <Button {...args} variant="secondary" trailingIcon={<ArrowRight size={14} strokeWidth={1.5} />}>
        Continue
      </Button>
    </div>
  ),
};

export const Loading: Story = {
  args: { variant: "primary", loading: true, children: "Running" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "Running" });
    await expect(button).toHaveAttribute("aria-busy", "true");
    await expect(button).toBeDisabled();
  },
};

export const Disabled: Story = {
  args: { variant: "primary", disabled: true, children: "Deploy workflow" },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "Deploy workflow" });
    await userEvent.click(button);
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};

export const FullWidth: Story = {
  args: { variant: "secondary", fullWidth: true, children: "Add step" },
  decorators: [
    (Story) => (
      <div className="w-[320px] bg-bg-panel p-4">
        <Story />
      </div>
    ),
  ],
};
