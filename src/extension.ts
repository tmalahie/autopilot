import * as vscode from 'vscode';
import { Configuration, OpenAIApi } from "openai";

import path = require("path")
import { config } from "dotenv";
config({ path: path.join(path.dirname(__dirname), ".env") });

export function activate(context: vscode.ExtensionContext) {
	const disposable = vscode.commands.registerCommand(
		'extension.autopilot-settings',
		() => {
			vscode.window.showInformationMessage('Show settings');
		}
	);

	const configuration = new Configuration({
		apiKey: process.env.OPENAI_API_KEY,
	});
	const openai = new OpenAIApi(configuration);

	context.subscriptions.push(disposable);

	let lastCallHandler: NodeJS.Timeout;

	const provider: vscode.InlineCompletionItemProvider = {
		provideInlineCompletionItems: async (document, position, context, token) => {
			console.log('provideInlineCompletionItems triggered');

			if (position.line <= 0)
				return;

			const firstLine = document.lineAt(0);
			const lastLine = document.lineAt(document.lineCount - 1);

			const textBefore = document.getText(new vscode.Range(firstLine.range.start, position));
			let textAfterLine = document.getText(new vscode.Range(position, lastLine.range.end));
			if (textAfterLine && !textAfterLine.startsWith("\r") && !textAfterLine.startsWith("\n"))
				return;
			
			if (!textBefore)
				return;

			console.log('debounce triggered');
			clearTimeout(lastCallHandler);
			await new Promise((resolve) => {
				lastCallHandler = setTimeout(resolve, 1000);
			});

			console.log('debounce completed');
			let completion: Awaited<ReturnType<typeof openai.createCompletion>>;
			try {
				completion = await openai.createCompletion({
					model: "davinci-codex",
					prompt: textBefore,
					max_tokens: 64,
					stop: "\n"//textAfterLine || "\n"
				});
			}
			catch (e) {
				console.error(e);
				return;
			}
			const predictions = completion.data.choices;
			if (!predictions?.length)
				return;

			console.log('success!');
			return predictions.map<vscode.InlineCompletionItem>((prediction) => ({
				insertText: prediction.text ?? "",
				range: new vscode.Range(position.line,position.character, position.line,position.character),
			}));
		},
	};

	vscode.languages.registerInlineCompletionItemProvider({ pattern: '**' }, provider);
}
