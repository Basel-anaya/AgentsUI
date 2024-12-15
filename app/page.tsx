"use client";

import React, { useState } from 'react';
import { Calendar, User, Clock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { addDays, format } from '@/lib/utils';

// Updated interfaces to use agent names
interface Agent {
  id: number;
  name: string;
}

interface Absence {
  agentId: number;
  agentName: string;
  day: string;
  date: string;
}

interface ScheduleRowProps {
  date: string;
  day?: string;
  agent: Agent;
  hours: string;
}

const AGENTS: Agent[] = [
  { id: 1, name: 'Odai' },
  { id: 2, name: 'Mohammad' },
  { id: 3, name: 'Majdi' }
];

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
          <div className="font-medium">{agent.name}</div>
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

  const getBaseSequenceForDate = (date: Date): Agent[] => {
    const referenceDate = new Date('2023-01-01');
    const daysSinceReference = Math.floor((date.getTime() - referenceDate.getTime()) / (24 * 60 * 60 * 1000));
    let baseIndex = daysSinceReference % 3;
    
    const sequence = [...AGENTS];
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

  const generateSchedule = (startDate: Date, numberOfDays: number) => {
    const schedule: Record<string, { agent: Agent; workingHours: string; date: string }> = {};
    const dates = generateDates(startDate, numberOfDays);
    
    let sequence = getBaseSequenceForDate(startDate);
    let currentIndex = 0;
    let previousAgent: Agent | null = null;

    dates.forEach(date => {
        const dayName = format(date, 'EEEE');
        const dateStr = format(date, 'yyyy-MM-dd');

        if (dayName === 'Saturday') return;

        let scheduledAgent = sequence[currentIndex];
        const absence = absences.find(a => a.date === dateStr);

        if (absence) {
            if (absence.agentId === scheduledAgent.id) {
                // Find best replacement (not previous day's agent)
                const availableAgents = sequence.filter(agent => 
                    agent.id !== absence.agentId && 
                    (!previousAgent || agent.id !== previousAgent.id)
                );
                
                scheduledAgent = availableAgents[0];
                
                // Reorder sequence - absent agent will be scheduled when they return
                sequence = [
                    ...sequence.filter(a => a.id !== scheduledAgent.id && a.id !== absence.agentId),
                    scheduledAgent,
                    sequence.find(a => a.id === absence.agentId)!
                ];
                currentIndex = 0;
            }
        } else if (previousAgent && previousAgent.id === scheduledAgent.id) {
            // Avoid consecutive days
            const nextAgent = sequence.find(agent => 
                agent.id !== scheduledAgent.id && 
                (!previousAgent || agent.id !== previousAgent.id)
            ) || sequence[(currentIndex + 1) % sequence.length];
            scheduledAgent = nextAgent;
        }

        schedule[dateStr] = {
            agent: scheduledAgent,
            workingHours: '7:30 - 3:30',
            date: dateStr
        };

        previousAgent = scheduledAgent;
        currentIndex = sequence.findIndex(a => a.id === scheduledAgent.id);
        currentIndex = (currentIndex + 1) % sequence.length;
    });

    return schedule;
  };

  const generateSaturdaySchedule = (startDate: Date, numberOfDays: number) => {
    const schedule: Record<string, { agent: Agent; workingHours: string; date: string }> = {};
    const dates = generateDates(startDate, numberOfDays);
    let sequence = getBaseSequenceForDate(startDate);

    // Find first Saturday's agent
    const firstSaturday = dates.find(date => format(date, 'EEEE') === 'Saturday');
    if (firstSaturday) {
      const startDate = new Date('2024-01-06'); // First Saturday of 2024
      const saturdays = Math.floor((firstSaturday.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
      const rotations = saturdays % AGENTS.length;
      
      // Rotate sequence to match historical Saturday rotations
      for (let i = 0; i < rotations; i++) {
        sequence.push(sequence.shift()!);
      }
    }

    let currentIndex = 0;

    dates.forEach(date => {
      const dayName = format(date, 'EEEE');
      const dateStr = format(date, 'yyyy-MM-dd');

      if (dayName === 'Saturday') {
        let assignedAgent = sequence[currentIndex];
        const absence = absences.find(a => a.date === dateStr);
        
        if (absence && absence.agentId === assignedAgent.id) {
          // If scheduled agent is absent, use next agent in sequence
          assignedAgent = sequence[(currentIndex + 1) % sequence.length];
        }

        schedule[dateStr] = {
          agent: assignedAgent,
          workingHours: '9:30 - 5:30',
          date: dateStr
        };
        
        // Move to next agent for next Saturday
        currentIndex = (currentIndex + 1) % sequence.length;
      }
    });

    return schedule;
  };

  const handleAbsenceSubmit = () => {
    if (selectedAgent && selectedDay) {
      const agent = AGENTS.find(a => a.id === selectedAgent);
      if (agent) {
        const date = format(new Date(selectedDay), 'yyyy-MM-dd');
        setAbsences([...absences, {
          agentId: agent.id,
          agentName: agent.name,
          day: format(new Date(selectedDay), 'EEEE'),
          date
        }]);
        setSelectedAgent(null);
        setSelectedDay(null);
      }
    }
  };

  const schedule = generateSchedule(new Date(selectedDate), Math.max(7, futureDays));
  const saturdaySchedule = generateSaturdaySchedule(new Date(selectedDate), Math.max(7, futureDays));

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
                  {AGENTS.map(agent => (
                    <option key={agent.id} value={agent.id}>{agent.name}</option>
                  ))}
                </select>
                <input
                  type="date"
                  value={selectedDay || ''}
                  onChange={(e) => setSelectedDay(e.target.value)}
                  className="p-2 border rounded"
                />
                <Button onClick={handleAbsenceSubmit}>Add Absence</Button>
                <Button variant="outline" onClick={() => setAbsences([])}>Clear All</Button>
              </div>
            </div>

            {/* Current Absences */}
            {absences.length > 0 && (
              <Alert>
                <AlertDescription>
                  Current Absences:
                  {absences.map((absence, index) => (
                    <div key={index}>
                      {absence.agentName} - {absence.date} ({absence.day})
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
                        day="Saturday"
                        agent={info.agent}
                        hours={`${info.workingHours} (8 hrs overtime)`}
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