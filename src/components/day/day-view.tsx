import type { DayActivity as Activity } from "@/lib/data/activity";
import type { Day } from "@/lib/data/day";
import { DayActivity } from "./day-activity";
import { DayMeals } from "./day-meals";
import { DaySummary } from "./day-summary";

export function DayView({ day, target, activity, weightKg }: { day: Day; target: number | null; activity: Activity; weightKg: number | null }) {
  return (
    <>
      <DaySummary target={target} total={day.total} burned={activity.burned} />
      <div className="mt-6">
        <DayMeals
          date={day.date}
          meals={day.meals.map((m) => ({
            type: m.type,
            subtotalKcal: m.subtotal.kcal,
            items: m.items.map((i) => ({
              id: i.id,
              name: i.name,
              preparation: i.preparation,
              quantity: i.quantity,
              unit: i.unit,
              grams: i.grams,
              kcal: i.nutrients.kcal,
              per100: i.per100,
            })),
          }))}
        />
      </div>
      <div className="mt-4">
        <DayActivity
          date={day.date}
          weightKg={weightKg}
          entries={activity.entries.map((e) => ({ id: e.id, kind: e.kind, km: e.km, kcal: e.kcal }))}
        />
      </div>
    </>
  );
}
