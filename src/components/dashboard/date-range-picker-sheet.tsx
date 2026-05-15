import { useState, useMemo } from 'react';
import { BottomSheet } from '@/components/bottom-sheet';
import { Touchable } from '@/components/touchable';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReportRange } from '@/services/reportSelectors';

export type DateRange = ReportRange;

interface DateRangePickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRange: DateRange;
  onSelectRange: (range: DateRange) => void;
  customDate?: Date;
  customEndDate?: Date;
  onSelectCustomDate?: (date: Date) => void;
  onSelectCustomEndDate?: (date: Date) => void;
}

const presets: { id: DateRange; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'thisWeek', label: 'This Week' },
  { id: 'lastWeek', label: 'Last Week' },
  { id: 'last7days', label: 'Last 7 Days' },
  { id: 'last30days', label: 'Last 30 Days' },
  { id: 'thisMonth', label: 'This Month' },
  { id: 'lastMonth', label: 'Last Month' },
  { id: 'thisYear', label: 'This Year' },
  { id: 'allTime', label: 'All Time' },
];

export function DateRangePickerSheet({ 
  isOpen, 
  onClose, 
  selectedRange, 
  onSelectRange,
  customDate = new Date(),
  customEndDate,
  onSelectCustomDate,
  onSelectCustomEndDate
}: DateRangePickerSheetProps) {
  const [viewDate, setViewDate] = useState(new Date(customDate));
  const selectedEndDate = customEndDate || customDate;
  const hasSelectedRange = Boolean(customEndDate && customEndDate.toDateString() !== customDate.toDateString());
  
  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    // Padding for start of month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(null);
    }
    // Days of month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  }, [viewDate]);

  const monthName = viewDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const isSelected = (date: Date | null) => {
    if (!date || selectedRange !== 'custom') return false;
    return date.toDateString() === customDate.toDateString() || date.toDateString() === selectedEndDate.toDateString();
  };

  const isInSelectedRange = (date: Date | null) => {
    if (!date || selectedRange !== 'custom' || !customEndDate) return false;
    const start = customDate <= customEndDate ? customDate : customEndDate;
    const end = customDate <= customEndDate ? customEndDate : customDate;
    return date > start && date < end;
  };

  const isToday = (date: Date | null) => {
    if (!date) return false;
    return date.toDateString() === new Date().toDateString();
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Choose Period">
      <div className="space-y-6 py-4 pb-2">
        {/* Presets Chips */}
        <div className="flex flex-wrap gap-2 px-1">
          {presets.map((preset) => (
            <Touchable
              key={preset.id}
              onPress={() => {
                onSelectRange(preset.id);
                onClose();
              }}
              className={cn(
                "px-4 py-2 rounded-full text-xs font-bold transition-all border",
                selectedRange === preset.id 
                  ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" 
                  : "bg-secondary text-muted-foreground border-transparent"
              )}
            >
              {preset.label}
            </Touchable>
          ))}
        </div>

        {/* Calendar View */}
        <div className="glass-card rounded-3xl p-4 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h4 className="font-bold text-sm">{monthName}</h4>
            <div className="flex gap-1">
              <Touchable 
                onPress={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
                className="p-2 bg-secondary rounded-xl"
              >
                <ChevronLeft size={16} />
              </Touchable>
              <Touchable 
                onPress={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
                className="p-2 bg-secondary rounded-xl"
              >
                <ChevronRight size={16} />
              </Touchable>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day) => (
              <div key={day} className="h-8 flex items-center justify-center text-[10px] font-black text-muted-foreground">
                {day}
              </div>
            ))}
            {calendarDays.map((date, i) => (
              <div key={i} className="aspect-square relative">
                {date && (
                  <Touchable
                    onPress={() => {
                      if (!onSelectCustomEndDate) {
                        onSelectCustomDate?.(date);
                        onSelectRange('custom');
                        onClose();
                        return;
                      }

                      if (selectedRange !== 'custom' || hasSelectedRange) {
                        onSelectCustomDate?.(date);
                        onSelectCustomEndDate?.(date);
                      } else {
                        onSelectCustomEndDate(date);
                        onClose();
                      }
                      onSelectRange('custom');
                    }}
                    className={cn(
                      "w-full h-full rounded-xl flex items-center justify-center text-xs font-bold transition-all",
                      isSelected(date) ? "bg-primary text-white shadow-md shadow-primary/30" : "hover:bg-secondary",
                      isInSelectedRange(date) ? "bg-primary/10 text-primary" : "",
                      isToday(date) && !isSelected(date) ? "text-primary border border-primary/20" : ""
                    )}
                  >
                    {date.getDate()}
                  </Touchable>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="px-4">
          <p className="text-[10px] text-center text-muted-foreground font-bold uppercase tracking-widest">
            {selectedRange === 'custom' 
              ? `Selected: ${customDate.toLocaleDateString()}${customEndDate && customEndDate.toDateString() !== customDate.toDateString() ? ` - ${customEndDate.toLocaleDateString()}` : ''}` 
              : `Preset: ${presets.find(p => p.id === selectedRange)?.label || 'All Time'}`}
          </p>
        </div>
      </div>
    </BottomSheet>
  );
}
