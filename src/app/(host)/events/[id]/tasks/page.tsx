import { notFound } from "next/navigation";
import { createTask, deleteTask, setTaskStatus } from "@/actions/tasks";
import { ActionForm } from "@/components/action-form";
import { Button, Card, EmptyState, Field, Pill, SectionTitle, Select, TextArea } from "@/components/ui";
import { TASK_PRIORITIES, type Task } from "@/db/schema";
import { countdownLabel, formatDateTime } from "@/lib/dates";
import { getEvent, getEventTasks, listHosts, type TaskRow } from "@/lib/queries";

const STATUS_LABEL: Record<Task["status"], string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

export default async function TasksPage({ params }: PageProps<"/events/[id]/tasks">) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();
  const [tasks, hosts] = await Promise.all([getEventTasks(id), listHosts()]);
  const now = new Date();
  const groups: Task["status"][] = ["todo", "in_progress", "done"];

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-6">
        {groups.map((status) => {
          const rows = tasks.filter((t) => t.status === status);
          return (
            <section key={status}>
              <SectionTitle>
                {STATUS_LABEL[status]} ({rows.length})
              </SectionTitle>
              {rows.length === 0 ? (
                <EmptyState>Nothing here.</EmptyState>
              ) : (
                <ul className="space-y-2">
                  {rows.map((t) => (
                    <TaskItem key={t.id} task={t} eventId={id} tz={event.timezone} now={now} />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <Card className="h-fit">
        <SectionTitle>Add a task</SectionTitle>
        <ActionForm action={createTask.bind(null, id)} className="space-y-3">
          <Field label="Title" name="title" required maxLength={160} />
          <Field label="Owner" name="assigneeId">
            <Select id="f-assigneeId" name="assigneeId" defaultValue="">
              <option value="">Unassigned</option>
              {hosts.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.displayName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Due" name="dueAt" type="datetime-local" hint={`Event time zone: ${event.timezone}`} />
          <Field label="Priority" name="priority">
            <Select id="f-priority" name="priority" defaultValue="normal">
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p[0].toUpperCase() + p.slice(1)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Notes" name="notes">
            <TextArea id="f-notes" name="notes" className="min-h-16" />
          </Field>
          <Button type="submit">Add task</Button>
        </ActionForm>
      </Card>
    </div>
  );
}

function TaskItem({ task, eventId, tz, now }: { task: TaskRow; eventId: string; tz: string; now: Date }) {
  const overdue = task.status !== "done" && task.dueAt !== null && task.dueAt < now;
  const next: Task["status"] | null =
    task.status === "todo" ? "in_progress" : task.status === "in_progress" ? "done" : null;
  return (
    <Card as="li" className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={"font-medium " + (task.status === "done" ? "text-navy/50 line-through" : "text-navy")}>
            {task.title}
          </span>
          {task.priority === "high" ? <Pill tone="bad">High</Pill> : null}
          {task.priority === "low" ? <Pill tone="neutral">Low</Pill> : null}
        </div>
        <p className="text-xs text-navy/60">
          {task.assigneeName ?? "Unassigned"}
          {task.dueAt ? (
            <>
              {" · "}
              <span className={overdue ? "font-semibold text-coral-deep" : ""} title={formatDateTime(task.dueAt, tz)}>
                {overdue ? "Overdue · " : "Due "}
                {countdownLabel(task.dueAt, tz, now).toLowerCase()}
              </span>
            </>
          ) : null}
        </p>
        {task.notes ? <p className="mt-1 text-sm text-navy/80">{task.notes}</p> : null}
      </div>
      <div className="flex gap-1 text-xs">
        {next ? (
          <form action={setTaskStatus}>
            <input type="hidden" name="taskId" value={task.id} />
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="status" value={next} />
            <button type="submit" className="min-h-9 rounded-md bg-sage px-2 font-medium text-navy hover:bg-sage/80">
              {next === "in_progress" ? "Start" : "Done"}
            </button>
          </form>
        ) : (
          <form action={setTaskStatus}>
            <input type="hidden" name="taskId" value={task.id} />
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="status" value="todo" />
            <button type="submit" className="min-h-9 rounded-md border border-navy/20 px-2 font-medium text-navy hover:bg-sky/40">
              Reopen
            </button>
          </form>
        )}
        <form action={deleteTask}>
          <input type="hidden" name="taskId" value={task.id} />
          <input type="hidden" name="eventId" value={eventId} />
          <button
            type="submit"
            className="min-h-9 rounded-md border border-coral-deep/40 px-2 font-medium text-coral-deep hover:bg-coral/15"
          >
            Delete
          </button>
        </form>
      </div>
    </Card>
  );
}
