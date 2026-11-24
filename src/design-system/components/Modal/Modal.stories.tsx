import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import { Button } from "../Button/Button";
import { Input } from "../Input/Input";
import { Modal } from "./Modal";

const meta = {
  title: "Design System/Modal",
  component: Modal,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Elevated command surface on Radix Dialog. Flat scrim, 1px strong border, 6px radius, no blur or shadow. " +
          "Focus is trapped, Escape closes, and the overlay click dismisses.",
      },
    },
  },
  args: {
    open: true,
    onOpenChange: fn(),
    title: "Publish workflow",
    description: "This snapshot becomes the active version for the production environment.",
    size: "md",
  },
  argTypes: {
    size: { control: "inline-radio", options: ["sm", "md", "lg"] },
    hideClose: { control: "boolean" },
  },
} satisfies Meta<typeof Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

const Body = () => (
  <div className="flex flex-col gap-3">
    <Input label="Version tag" mono placeholder="v1.4.0" />
    <p>
      Nodes will be frozen at their current configuration. Running executions keep the version they
      started with.
    </p>
  </div>
);

export const Default: Story = {
  render: () => <div className="min-h-[320px] bg-bg-canvas bg-dot-grid p-6" />,
  args: {
    children: <Body />,
    footer: (
      <>
        <Button variant="ghost">Cancel</Button>
        <Button variant="primary">Publish v1.4.0</Button>
      </>
    ),
  },
};

export const Interactive: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <div className="flex min-h-[320px] items-start bg-bg-canvas bg-dot-grid p-6">
        <Button variant="primary" onClick={() => setOpen(true)}>
          Open modal
        </Button>
        <Modal
          open={open}
          onOpenChange={setOpen}
          title="Publish workflow"
          description="This snapshot becomes the active version for the production environment."
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => setOpen(false)}>
                Publish v1.4.0
              </Button>
            </>
          }
        >
          <Body />
        </Modal>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: "Open modal" }));

    // The panel is portalled to document.body, outside the story canvas.
    const dialog = await screen.findByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(within(dialog).getByText("Publish workflow")).toBeVisible();

    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  },
};

export const Small: Story = {
  args: {
    size: "sm",
    title: "Delete node",
    description: "This action cannot be undone.",
    children: "The node and its 3 downstream connections will be removed from the graph.",
    footer: (
      <>
        <Button variant="ghost">Cancel</Button>
        <Button variant="danger">Delete node</Button>
      </>
    ),
  },
};

export const Large: Story = {
  args: {
    size: "lg",
    title: "Run configuration",
    children: <Body />,
    footer: <Button variant="primary">Start run</Button>,
  },
};
