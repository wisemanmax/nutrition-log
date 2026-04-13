import { uid } from '../utils/helpers';

export const init = {
  tab: "home",
  nutrition: [],
  body: [],
  loaded: false,
  onboarded: false,
  units: "lbs",
  goals: { cal: 2400, protein: 180, carbs: 250, fat: 70 },
  profile: { firstName: "", lastName: "", email: "", height: "", sex: "" },
};

export function reducer(s, a) {
  switch (a.type) {
    case "INIT": return { ...s, ...a.p, loaded: true };
    case "TAB": return { ...s, tab: a.tab };
    case "ADD_N": {
      if (s.nutrition.some(n => n.id === a.n.id)) return s;
      return { ...s, nutrition: [a.n, ...s.nutrition].sort((a, b) => b.date.localeCompare(a.date)) };
    }
    case "EDIT_N": return { ...s, nutrition: s.nutrition.map(n => n.id === a.n.id ? a.n : n) };
    case "DEL_N": return { ...s, nutrition: s.nutrition.filter(n => n.id !== a.id) };
    case "ADD_B": {
      if (s.body.some(b => b.id === a.b.id)) return s;
      return { ...s, body: [a.b, ...s.body].sort((a, b) => b.date.localeCompare(a.date)) };
    }
    case "DEL_B": return { ...s, body: s.body.filter(b => b.id !== a.id) };
    case "GOALS": return { ...s, goals: { ...s.goals, ...a.g } };
    case "UNITS": return { ...s, units: a.units };
    case "SET_PROFILE": return { ...s, profile: { ...(s.profile || {}), ...a.profile } };
    case "ONBOARDED": return { ...s, onboarded: true };
    case "IMPORT": return { ...s, ...a.data, loaded: true };
    case "CLEAR_ALL": return { ...init, loaded: true, onboarded: true, profile: s.profile };
    default: return s;
  }
}
