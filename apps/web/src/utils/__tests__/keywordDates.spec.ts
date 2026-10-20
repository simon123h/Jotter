import { describe, it, expect } from 'vitest';
import { keywordDates, type DateField } from '../keywordDates';

const setup = (initial: Record<DateField, string>) => {
  const form = { ...initial };
  const dates = keywordDates(
    (field) => form[field],
    (field, value) => (form[field] = value)
  );
  return { form, dates };
};

describe('keywordDates', () => {
  it('sets the date a keyword stands for, and gives the old one back when the keyword goes', () => {
    const { form, dates } = setup({ dueDate: '', plannedDate: '2030-W19' });
    dates.apply({ dueDate: null, plannedDate: '2040-01-02' });
    expect(form).toEqual({ dueDate: '', plannedDate: '2040-01-02' });
    dates.clear();
    expect(form).toEqual({ dueDate: '', plannedDate: '2030-W19' });
  });

  it('leaves the other date alone, also when the keyword turns into a deadline', () => {
    const { form, dates } = setup({ dueDate: '2031-03-04', plannedDate: '2030-W19' });
    dates.apply({ dueDate: null, plannedDate: '2040-01-02' });
    dates.apply({ dueDate: '2040-01-02', plannedDate: null });
    expect(form).toEqual({ dueDate: '2040-01-02', plannedDate: '2030-W19' }); // the plan is back, the deadline is the keyword's
    dates.clear();
    expect(form).toEqual({ dueDate: '2031-03-04', plannedDate: '2030-W19' });
  });

  it('keeps a date that was changed by hand after the keyword set it', () => {
    const { form, dates } = setup({ dueDate: '', plannedDate: '2030-W19' });
    dates.apply({ dueDate: null, plannedDate: '2040-01-02' });
    form.plannedDate = '2050-05-05'; // picked by hand
    dates.clear();
    expect(form.plannedDate).toBe('2050-05-05');
  });

  it('forgets everything when the form starts again', () => {
    const { form, dates } = setup({ dueDate: '', plannedDate: '' });
    dates.apply({ dueDate: null, plannedDate: '2040-01-02' });
    dates.reset();
    dates.clear();
    expect(form.plannedDate).toBe('2040-01-02');
  });
});
