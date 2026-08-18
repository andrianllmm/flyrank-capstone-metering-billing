// session has no period data; customer.subscription.updated corrects this later.
export function approximateMonthlyPeriod(): { currentPeriodStart: Date; currentPeriodEnd: Date } {
  const currentPeriodStart = new Date();
  const currentPeriodEnd = new Date(currentPeriodStart);
  currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
  return { currentPeriodStart, currentPeriodEnd };
}
