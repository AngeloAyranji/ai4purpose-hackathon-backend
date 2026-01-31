import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import {
  ScenarioResults,
  MapData,
  MitigationComparisonResult,
} from '../scenario/dto/scenario.dto';

export interface ToolEvent {
  toolName: string;
  args: Record<string, any>;
  result?: any;
  timestamp: string;
}

export interface ScenarioProgressEvent {
  scenarioId: string;
  step: string;
  stepIndex: number;
  totalSteps: number;
  progress: number;
  partialData: any;
  timestamp: string;
}

export interface ScenarioCompleteEvent {
  scenarioId: string;
  report: string;
  structured: ScenarioResults;
  mapData: MapData;
  timestamp: string;
}

export interface ScenarioErrorEvent {
  scenarioId: string;
  error: string;
  step?: string;
  timestamp: string;
}

export interface MitigationComparisonEvent {
  scenarioId: string;
  baseline: MitigationComparisonResult['baseline'];
  withMitigation: MitigationComparisonResult['withMitigation'];
  improvement: MitigationComparisonResult['improvement'];
  timestamp: string;
}

// Convert camelCase to UPPER_SNAKE_CASE
function toUpperSnakeCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
}

@Injectable()
export class PublisherService {
  private server: Server | null = null;

  setServer(server: Server) {
    this.server = server;
  }

  emitToolStarted(sessionId: string, toolName: string, args: Record<string, any>) {
    if (!this.server) return;

    const event: ToolEvent = {
      toolName,
      args,
      timestamp: new Date().toISOString(),
    };

    const eventName = `${toUpperSnakeCase(toolName)}_STARTED`;
    this.server.to(sessionId).emit(eventName, event);
  }

  emitToolEnded(sessionId: string, toolName: string, args: Record<string, any>, result: any) {
    if (!this.server) return;

    const event: ToolEvent = {
      toolName,
      args,
      result,
      timestamp: new Date().toISOString(),
    };

    const eventName = `${toUpperSnakeCase(toolName)}_ENDED`;
    this.server.to(sessionId).emit(eventName, event);
  }

  emitAgentResponse(
    sessionId: string,
    response: {
      text: string;
      toolCalls: any[];
      steps: number;
      usage: any;
    },
  ): void {
    if (!this.server) return;

    this.server.to(sessionId).emit('AGENT_RESPONSE', {
      ...response,
      timestamp: new Date().toISOString(),
    });
  }

  // Scenario-specific events
  emitScenarioProgress(
    sessionId: string,
    scenarioId: string,
    step: string,
    stepIndex: number,
    totalSteps: number,
    progress: number,
    partialData: any,
  ): void {
    if (!this.server) return;

    const event: ScenarioProgressEvent = {
      scenarioId,
      step,
      stepIndex,
      totalSteps,
      progress,
      partialData,
      timestamp: new Date().toISOString(),
    };

    this.server.to(sessionId).emit('SCENARIO_PROGRESS', event);
  }

  emitScenarioComplete(
    sessionId: string,
    scenarioId: string,
    results: ScenarioResults,
    report: string,
    mapData: MapData,
  ): void {
    if (!this.server) return;

    const event: ScenarioCompleteEvent = {
      scenarioId,
      report,
      structured: results,
      mapData,
      timestamp: new Date().toISOString(),
    };

    this.server.to(sessionId).emit('SCENARIO_COMPLETE', event);
  }

  emitScenarioError(
    sessionId: string,
    scenarioId: string,
    error: string,
    step?: string,
  ): void {
    if (!this.server) return;

    const event: ScenarioErrorEvent = {
      scenarioId,
      error,
      step,
      timestamp: new Date().toISOString(),
    };

    this.server.to(sessionId).emit('SCENARIO_ERROR', event);
  }

  emitMitigationComparison(
    sessionId: string,
    scenarioId: string,
    comparison: MitigationComparisonResult,
  ): void {
    if (!this.server) return;

    const event: MitigationComparisonEvent = {
      scenarioId,
      baseline: comparison.baseline,
      withMitigation: comparison.withMitigation,
      improvement: comparison.improvement,
      timestamp: new Date().toISOString(),
    };

    this.server.to(sessionId).emit('MITIGATION_COMPARISON', event);
  }
}
