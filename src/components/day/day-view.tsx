import type { Day } from "@/lib/data/day";
import { DayMeals } from "./day-meals";
import { DaySummary } from "./day-summary";

export function DayView({ day, target }: { day: Day; target: number | null }) {
  return (
    <>
      <DaySummary target={target} total={day.total} />
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
    </>
  );
}
