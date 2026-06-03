import type { AgentId } from '../../core/agent/AgentTask';
import type { ProjectMapAiSummary } from '../../context/project-map/summary/types';
import { ProjectMapSummaryPromptBuilder } from '../../context/project-map/summary/ProjectMapSummaryPromptBuilder';
import { ProjectMapAiRunner } from '../../infrastructure/ai/ProjectMapAiRunner';
import { AiJsonExtractor } from '../../context/project-map/summary/AiJsonExtractor';
import { ProjectMapSummaryValidator } from '../../context/project-map/summary/ProjectMapSummaryValidator';
import { ProjectMapMarkdownRenderer } from '../../context/project-map/summary/ProjectMapMarkdownRenderer';
import { ProjectMapSummaryWriter } from '../../context/project-map/summary/ProjectMapSummaryWriter';

export type SummarizeResult = {
  summary: ProjectMapAiSummary;
  filesWritten: string[];
};

export class SummarizeProjectMapUseCase {
  constructor(
    private readonly promptBuilder: ProjectMapSummaryPromptBuilder,
    private readonly aiRunner: ProjectMapAiRunner,
    private readonly extractor: AiJsonExtractor,
    private readonly validator: ProjectMapSummaryValidator,
    private readonly renderer: ProjectMapMarkdownRenderer,
    private readonly writer: ProjectMapSummaryWriter,
  ) { }

  async execute(input: { workspaceRoot: string; provider: AgentId }): Promise<SummarizeResult> {
    const [baseProjectMap, fileTree, unitsJson] = await Promise.all([
      this.writer.readProjectMap(input.workspaceRoot),
      this.writer.readFileTree(input.workspaceRoot),
      this.writer.readWorkspaceUnits(input.workspaceRoot),
    ]);

    const prompt = this.promptBuilder.build({ baseProjectMap, fileTree, unitsJson });
    const result = await this.aiRunner.run({ provider: input.provider, prompt });

    if (!result.succeeded) {
      throw new Error(`AI CLI exited with code ${result.exitCode}:\n${result.stderr}`);
    }

    let parsed: unknown;
    try {
      parsed = this.extractor.extract(result.stdout);
    } catch (err) {
      await this.writer.writeRawDebug(input.workspaceRoot, result.stdout);
      throw new Error(
        `Failed to extract JSON from AI output. Raw saved to .nexus/project-summary.raw.txt\n${err}`,
      );
    }

    let summary: ProjectMapAiSummary;
    try {
      summary = this.validator.validate(parsed);
    } catch (err) {
      await this.writer.writeRawDebug(input.workspaceRoot, result.stdout);
      throw new Error(
        `AI summary validation failed. Raw saved to .nexus/project-summary.raw.txt\n${err}`,
      );
    }

    await this.writer.writeSummaryJson(input.workspaceRoot, summary);

    const markdown = this.renderer.render({ baseProjectMap, aiSummary: summary });
    await this.writer.writeProjectMap(input.workspaceRoot, markdown);

    return {
      summary,
      filesWritten: ['.nexus/project-summary.json', '.nexus/project-map.md'],
    };
  }
}
