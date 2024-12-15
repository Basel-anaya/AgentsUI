"use client";

import React, { useState } from 'react';
import { Calendar, User, Clock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { addDays, format } from '@/lib/utils';

interface Absence {
  agent: number;
  day: string;
  date: string;
}

interface OvertimeRecord {
  agent: number;
  date: string;
  hours: string;
}

interface ScheduleRowProps {
  date: string;
  day?: string;
  agent: number;
  hours: string;
}

interface WorkloadCount {
  [key: number]: number;
}

const ScheduleRow = ({ date, day, agent, hours }: ScheduleRowProps) => {
  return (
    <tr className="border-t">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-500" />
          <div>
            <div className="font-medium">{date}</div>
            {day && <div className="text-sm text-gray-600">{day}</div>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-gray-500" />
          <div className="font-medium">Agent {agent}</div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-500" />
          <div className="font-medium">{hours}</div>
        </div>
      </td>
    </tr>
  );
};

const SupportScheduleUI = () => {
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState<string>(format(today, 'yyyy-MM-dd'));
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [futureDays, setFutureDays] = useState<number>(7);

  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
  const agents = [1, 2, 3];

  // Helper function to get the base sequence for any given date
  const getBaseSequenceForDate = (date: Date): number[] => {
    const referenceDate = new Date('2023-01-01');
    const daysSinceReference = Math.floor((date.getTime() - referenceDate.getTime()) / (24 * 60 * 60 * 1000));
    let baseIndex = daysSinceReference % 3;
    
    const sequence = [1, 2, 3];
    while (baseIndex > 0) {
      sequence.push(sequence.shift()!);
      baseIndex--;
    }
    return sequence;
  };

  const generateDates = (startDate: Date, days: number) => {
    const dates: Date[] = [];
    for (let i = 0; i < days; i++) {
      const date = addDays(startDate, i);
      const dayName = format(date, 'EEEE');
      if (dayName !== 'Friday') {
        dates.push(date);
      }
    }
    return dates;
  };

  // New function to determine optimal sequence based on workload
  const getOptimalSequence = (workloadCounts: WorkloadCount, absentAgent?: number): number[] => {
    const availableAgents = agents.filter(agent => agent !== absentAgent);
    
    // Sort agents by workload (least to most)
    const sortedAgents = [...availableAgents].sort((a, b) => 
      (workloadCounts[a] || 0) - (workloadCounts[b] || 0)
    );

    // If there's an absent agent, they'll be added back to the sequence later
    if (absentAgent) {
      return sortedAgents;
    }

    // For normal rotation, ensure even distribution
    return agents.sort((a, b) => (workloadCounts[a] || 0) - (workloadCounts[b] || 0));
  };

  // Modified schedule generation to handle dynamic sequence changes
  const generateSchedule = (startDate: Date, numberOfDays: number) => {
    const schedule: Record<string, { agent: number; workingHours: string; date: string }> = {};
    const dates = generateDates(startDate, numberOfDays);
    
    let sequence = getBaseSequenceForDate(startDate);
    let currentIndex = 0;
    let previousAgent: number | null = null;

    dates.forEach(date => {
        const dayName = format(date, 'EEEE');
        const dateStr = format(date, 'yyyy-MM-dd');

        if (dayName === 'Saturday') return;

        // Get the expected agent for this date based on the rotation
        let scheduledAgent = sequence[currentIndex];
        const absence = absences.find(a => a.date === dateStr);

        if (absence) {
            if (absence.agent === scheduledAgent) {
                // If scheduled agent is absent, find the best replacement
                const availableAgents = sequence.filter(agent => 
                    agent !== absence.agent && 
                    agent !== previousAgent
                );
                
                scheduledAgent = availableAgents[0];
                
                // Adjust sequence to maintain spacing after absence
                sequence = [
                    ...sequence.filter(a => a !== scheduledAgent && a !== absence.agent),
                    scheduledAgent,
                    absence.agent
                ];
                currentIndex = 0;
            }
        } else if (previousAgent === scheduledAgent) {
            // Avoid consecutive days even in normal schedule
            const nextAgent = sequence.find(agent => 
                agent !== scheduledAgent && 
                agent !== previousAgent
            ) || sequence[(currentIndex + 1) % sequence.length];
            scheduledAgent = nextAgent;
        }

        schedule[dateStr] = {
            agent: scheduledAgent,
            workingHours: '7:30 - 3:30',
            date: dateStr
        };

        previousAgent = scheduledAgent;
        currentIndex = (sequence.indexOf(scheduledAgent) + 1) % sequence.length;
    });

    return schedule;
  };

  // Rest of the component remains the same...
  const generateSaturdaySchedule = (startDate: Date, numberOfDays: number) => {
    const schedule: Record<string, { agent: number; workingHours: string; date: string }> = {};
    const dates = generateDates(startDate, numberOfDays);
    const sequence = getBaseSequenceForDate(startDate);

    dates.forEach(date => {
      const dayName = format(date, 'EEEE');
      const dateStr = format(date, 'yyyy-MM-dd');

      if (dayName === 'Saturday') {
        let assignedAgent = sequence[0];
        const absence = absences.find(a => a.date === dateStr);
        
        if (absence && absence.agent === assignedAgent) {
          assignedAgent = sequence[1];
        }

        schedule[dateStr] = {
          agent: assignedAgent,
          workingHours: '9:30 - 5:30',
          date: dateStr
        };
        
        // Rotate sequence for next Saturday
        sequence.push(sequence.shift()!);
      }
    });

    return schedule;
  };

  const getOvertimeStats = () => {
    const stats = agents.map(agent => {
      const count = Object.values(saturdaySchedule).filter(
        shift => shift.agent === agent
      ).length;
      
      return {
        agent,
        count
      };
    });
    return stats;
  };

  const schedule = generateSchedule(new Date(selectedDate), Math.max(7, futureDays));
  const saturdaySchedule = generateSaturdaySchedule(new Date(selectedDate), Math.max(7, futureDays));

  const handleAbsenceSubmit = () => {
    if (selectedAgent && selectedDay) {
      const date = format(new Date(selectedDay), 'yyyy-MM-dd');
      setAbsences([...absences, { agent: selectedAgent, day: format(new Date(selectedDay), 'EEEE'), date }]);
      setSelectedAgent(null);
      setSelectedDay(null);
    }
  };

  const clearAbsences = () => {
    setAbsences([]);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-6 h-6" />
            Support Agent Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Date and Future Days Selection */}
            <div className="flex gap-4 items-center">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="p-2 border rounded"
              />
              <input
                type="number"
                value={futureDays}
                onChange={(e) => setFutureDays(Number(e.target.value))}
                placeholder="Number of days to show"
                className="p-2 border rounded w-48"
              />
            </div>

            {/* Overtime Statistics */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Saturday Overtime Statistics</h3>
              <div className="grid grid-cols-3 gap-4">
                {getOvertimeStats().map(({ agent, count }) => (
                  <div key={agent} className="bg-gray-50 p-4 rounded-lg">
                    <div className="font-medium">Agent {agent}</div>
                    <div className="text-sm text-gray-600">{count} Saturday shifts</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Absence Management */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Report Absence</h3>
              <div className="flex gap-4 items-center">
                <select 
                  value={selectedAgent || ''} 
                  onChange={(e) => setSelectedAgent(Number(e.target.value))}
                  className="p-2 border rounded"
                >
                  <option value="">Select Agent</option>
                  {agents.map(agent => (
                    <option key={agent} value={agent}>Agent {agent}</option>
                  ))}
                </select>
                <input
                  type="date"
                  value={selectedDay || ''}
                  onChange={(e) => setSelectedDay(e.target.value)}
                  className="p-2 border rounded"
                />
                <Button onClick={handleAbsenceSubmit}>Add Absence</Button>
                <Button variant="outline" onClick={clearAbsences}>Clear All</Button>
              </div>
            </div>

            {/* Current Absences */}
            {absences.length > 0 && (
              <Alert>
                <AlertDescription>
                  Current Absences:
                  {absences.map((absence, index) => (
                    <div key={index}>
                      Agent {absence.agent} - {absence.date} ({absence.day})
                    </div>
                  ))}
                </AlertDescription>
              </Alert>
            )}

            {/* Saturday Schedule */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Saturday Schedule (Overtime)</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Date</th>
                      <th className="px-4 py-2 text-left font-medium">Agent</th>
                      <th className="px-4 py-2 text-left font-medium">Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(saturdaySchedule).map(([date, info]) => (
                      <ScheduleRow
                        key={date}
                        date={date}
                        agent={info.agent}
                        hours={`${info.workingHours} (${8} hrs overtime)`}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Weekday Schedule */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Weekday Schedule</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Date</th>
                      <th className="px-4 py-2 text-left font-medium">Agent</th>
                      <th className="px-4 py-2 text-left font-medium">Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(schedule).map(([date, info]) => (
                      <ScheduleRow
                        key={date}
                        date={date}
                        day={format(new Date(date), 'EEEE')}
                        agent={info.agent}
                        hours={info.workingHours}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SupportScheduleUI;