import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class ScenarioParameters {
  @Prop({ required: true, enum: ['blast', 'earthquake'] })
  disasterType: 'blast' | 'earthquake';

  @Prop({ required: true })
  lat: number;

  @Prop({ required: true })
  lon: number;

  @Prop()
  yield?: number;

  @Prop()
  magnitude?: number;

  @Prop({ default: 'afternoon' })
  timeOfDay: string;

  @Prop({ default: true })
  includeVulnerability: boolean;

  @Prop()
  customInput?: string;
}

export const ScenarioParametersSchema =
  SchemaFactory.createForClass(ScenarioParameters);

@Schema()
export class ScenarioStep {
  @Prop({ required: true })
  name: string;

  @Prop({
    enum: ['pending', 'running', 'completed', 'failed'],
    default: 'pending',
  })
  status: string;

  @Prop({ type: Object })
  result?: Record<string, any>;
}

export const ScenarioStepSchema = SchemaFactory.createForClass(ScenarioStep);

@Schema()
export class MitigationPlan {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  type: string;

  @Prop()
  cost: number;

  @Prop({ type: [String] })
  targetBuildingIds: string[];

  @Prop({ type: Object })
  projectedOutcome: Record<string, any>;
}

export const MitigationPlanSchema =
  SchemaFactory.createForClass(MitigationPlan);

@Schema({ timestamps: true })
export class Scenario extends Document {
  @Prop({ required: true, unique: true, index: true })
  scenarioId: string;

  @Prop({ required: true })
  sessionId: string;

  @Prop({ required: true })
  name: string;

  @Prop({
    enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
    default: 'pending',
  })
  status: string;

  @Prop({ type: ScenarioParametersSchema, required: true })
  parameters: ScenarioParameters;

  @Prop({ type: [ScenarioStepSchema], default: [] })
  steps: ScenarioStep[];

  @Prop({ default: 0 })
  progress: number;

  @Prop({ type: Object })
  results?: Record<string, any>;

  @Prop({ type: [MitigationPlanSchema], default: [] })
  mitigationPlans: MitigationPlan[];

  @Prop()
  reportMarkdown?: string;
}

export const ScenarioSchema = SchemaFactory.createForClass(Scenario);
