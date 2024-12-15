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

  const getAssignedAgent = (date: Date): Agent => {
    // Get the month and year
    const month = date.getMonth();
    const year = date.getFullYear();
    
    // Calculate months since a reference point (e.g., January 2024)
    const referenceDate = new Date(2024, 0, 1); // January 1, 2024
    const monthsSinceReference = (year - referenceDate.getFullYear()) * 12 + month - referenceDate.getMonth();
    
    // Get base agent for this month
    const baseAgentIndex = monthsSinceReference % AGENTS.length;
    
    // Calculate week number within the month
    const firstDayOfMonth = new Date(year, month, 1);
    const firstSunday = new Date(year, month, 1 + (7 - firstDayOfMonth.getDay()) % 7);
    const weekInMonth = Math.floor((date.getDate() - firstSunday.getDate()) / 7);
    
    // Rotate through agents based on week within the month
    const finalAgentIndex = (baseAgentIndex + weekInMonth) % AGENTS.length;
    return AGENTS[finalAgentIndex];
  };

  const getWeekNumber = (date: Date): number => {
    const start = new Date(date.getFullYear(), 0, 1);
    const diff = date.getTime() - start.getTime();
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    return Math.floor(diff / oneWeek);
  };

  const getWeekInfo = (date: Date): { weekStartDate: Date; agentIndex: number } => {
    // Get Sunday of the current week
    const sunday = new Date(date);
    sunday.setDate(date.getDate() - date.getDay());
    
    // Get the current week number within the current month
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const firstSunday = new Date(monthStart);
    firstSunday.setDate(monthStart.getDate() + (7 - monthStart.getDay()) % 7);
    
    // Calculate which agent should be working based on the current week
    const weekOfMonth = Math.floor((date.getDate() - firstSunday.getDate()) / 7);
    const monthOffset = date.getMonth() % AGENTS.length;
    const agentIndex = (monthOffset + weekOfMonth) % AGENTS.length;
    
    return {
      weekStartDate: sunday,
      agentIndex
    };
  };

  const generateSchedule = (startDate: Date, numberOfDays: number) => {
    const schedule: Record<string, { agent: Agent; workingHours: string; date: string }> = {};
    const dates = generateDates(startDate, numberOfDays);
    
    // Get weeks map first
    const weeksMap = new Map<string, Agent>();
    let currentAgentIndex = 0;
    
    // First pass: Assign base weeks
    dates.forEach(date => {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay()); // Get Sunday
      const weekStartStr = format(weekStart, 'yyyy-MM-dd');
      
      if (!weeksMap.has(weekStartStr)) {
        weeksMap.set(weekStartStr, AGENTS[currentAgentIndex]);
        currentAgentIndex = (currentAgentIndex + 1) % AGENTS.length;
      }
    });
  
    // Second pass: Handle absences and cascading coverage
    const absenceCascades = new Map<string, Agent[]>(); // Track coverage chains by weekday
  
    dates.forEach(date => {
      const dayName = format(date, 'EEEE');
      const dateStr = format(date, 'yyyy-MM-dd');
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  
      if (dayName === 'Saturday') return;
  
      let assignedAgent = weeksMap.get(weekStartStr)!;
      const absence = absences.find(a => a.date === dateStr);
  
      if (absence && absence.agentId === assignedAgent.id) {
        // Start or continue cascade
        const nextAgent = AGENTS[(AGENTS.findIndex(a => a.id === assignedAgent.id) + 1) % AGENTS.length];
        
        if (!absenceCascades.has(dayName)) {
          absenceCascades.set(dayName, [assignedAgent, nextAgent]);
        }
        
        assignedAgent = nextAgent;
      } else if (absenceCascades.has(dayName)) {
        // Check if this agent is part of a cascade
        const cascade = absenceCascades.get(dayName)!;
        const agentIndex = cascade.findIndex(a => a.id === assignedAgent.id);
        
        if (agentIndex >= 0) {
          // This agent should be covered by next in sequence
          const nextAgent = AGENTS[(AGENTS.findIndex(a => a.id === assignedAgent.id) + 1) % AGENTS.length];
          assignedAgent = nextAgent;
          
          // Update cascade array
          if (!cascade.find(a => a.id === nextAgent.id)) {
            cascade.push(nextAgent);
            absenceCascades.set(dayName, cascade);
          }
        }
      }
  
      schedule[dateStr] = {
        agent: assignedAgent,
        workingHours: '7:30 - 3:30',
        date: dateStr
      };
    });
  
    return schedule;
  };
  

const generateSaturdaySchedule = (startDate: Date, numberOfDays: number) => {
  const schedule: Record<string, { agent: Agent; workingHours: string; date: string }> = {};
  const dates = generateDates(startDate, numberOfDays);
  
  // Track Saturday assignments for balanced distribution
  const saturdayCount: Record<number, number> = {};
  AGENTS.forEach(agent => saturdayCount[agent.id] = 0);
  
  dates.forEach(date => {
    const dayName = format(date, 'EEEE');
    const dateStr = format(date, 'yyyy-MM-dd');

    if (dayName === 'Saturday') {
      // Find agent with least Saturday assignments
      const nextAgent = AGENTS
        .sort((a, b) => saturdayCount[a.id] - saturdayCount[b.id])[0];
      
      let assignedAgent = nextAgent;
      const absence = absences.find(a => a.date === dateStr);
      
      if (absence && absence.agentId === assignedAgent.id) {
        // Assign to next agent with least Saturdays
        assignedAgent = AGENTS
          .filter(a => a.id !== absence.agentId)
          .sort((a, b) => saturdayCount[a.id] - saturdayCount[b.id])[0];
      }

      saturdayCount[assignedAgent.id]++;
      
      schedule[dateStr] = {
        agent: assignedAgent,
        workingHours: '9:30 - 5:30',
        date: dateStr
      };
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

            {/* Overtime Statistics */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Saturday Overtime Statistics</h3>
              <div className="grid grid-cols-3 gap-4">
                {AGENTS.map(agent => {
                  const saturdayCount = Object.values(saturdaySchedule)
                    .filter(shift => shift.agent.id === agent.id).length;
                  return (
                    <div key={agent.id} className="bg-gray-50 p-4 rounded-lg">
                      <div className="font-medium">{agent.name}</div>
                      <div className="text-sm text-gray-600">
                        {saturdayCount} Saturday shift{saturdayCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                  );
                })}
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