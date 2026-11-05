export type FoodFormValues = {
  id: string | null;
  name: string;
  preparation: string;
  brand: string;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
  sourceType: string;
  sourceRef: string;
  validated: boolean;
  units: { name: string; grams: string }[];
  aliases: string;
};

export const EMPTY_FOOD: FoodFormValues = {
  id: null,
  name: "",
  preparation: "na",
  brand: "",
  kcal: "",
  protein: "",
  carbs: "",
  fat: "",
  fiber: "",
  sourceType: "label",
  sourceRef: "",
  validated: true,
  units: [],
  aliases: "",
};

