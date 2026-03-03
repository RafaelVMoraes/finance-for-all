import {
  Briefcase,
  Car,
  CircleDollarSign,
  CreditCard,
  Dumbbell,
  Film,
  Gamepad2,
  GraduationCap,
  HandCoins,
  HeartPulse,
  House,
  Landmark,
  Pizza,
  Plane,
  Receipt,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Ticket,
  Utensils,
} from 'lucide-react';

export const CATEGORY_ICON_OPTIONS = [
  'shopping-basket',
  'utensils',
  'house',
  'car',
  'landmark',
  'credit-card',
  'briefcase',
  'heart-pulse',
  'dumbbell',
  'graduation-cap',
  'film',
  'plane',
  'shirt',
  'smartphone',
  'pizza',
  'ticket',
  'receipt',
  'circle-dollar-sign',
  'hand-coins',
  'gamepad-2',
] as const;

export type CategoryIconName = (typeof CATEGORY_ICON_OPTIONS)[number];

export const CATEGORY_ICON_LABELS: Record<CategoryIconName, string> = {
  'shopping-basket': 'Groceries',
  utensils: 'Dining',
  house: 'Housing',
  car: 'Transport',
  landmark: 'Taxes & Fees',
  'credit-card': 'Subscriptions',
  briefcase: 'Salary',
  'heart-pulse': 'Health',
  dumbbell: 'Fitness',
  'graduation-cap': 'Education',
  film: 'Entertainment',
  plane: 'Travel',
  shirt: 'Clothing',
  smartphone: 'Phone & Internet',
  pizza: 'Takeout',
  ticket: 'Events',
  receipt: 'Bills',
  'circle-dollar-sign': 'Income',
  'hand-coins': 'Savings',
  'gamepad-2': 'Hobbies',
};

export const CATEGORY_ICON_MAP = {
  'shopping-basket': ShoppingBasket,
  utensils: Utensils,
  house: House,
  car: Car,
  landmark: Landmark,
  'credit-card': CreditCard,
  briefcase: Briefcase,
  'heart-pulse': HeartPulse,
  dumbbell: Dumbbell,
  'graduation-cap': GraduationCap,
  film: Film,
  plane: Plane,
  shirt: Shirt,
  smartphone: Smartphone,
  pizza: Pizza,
  ticket: Ticket,
  receipt: Receipt,
  'circle-dollar-sign': CircleDollarSign,
  'hand-coins': HandCoins,
  'gamepad-2': Gamepad2,
} as const;

export function getCategoryIcon(iconName?: string | null) {
  if (!iconName || !(iconName in CATEGORY_ICON_MAP)) {
    return CircleDollarSign;
  }

  return CATEGORY_ICON_MAP[iconName as CategoryIconName] ?? CircleDollarSign;
}
