/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';
import * as paths from 'vs/base/common/path';
import { DEFAULT_TERMINAL_OSX, IExternalTerminalService, IExternalTerminalSettings } from 'vs/platform/externalTerminal/common/externalTerminal';
import { MenuId, MenuRegistry } from 'vs/platform/actions/common/actions';
import { KeyMod, KeyCode } from 'vs/base/common/keyCodes';
import { IHistoryService } from 'vs/workbench/services/history/common/history';
import { KeybindingsRegistry, KeybindingWeight } from 'vs/platform/keybinding/common/keybindingsRegistry';
import { Schemas } from 'vs/base/common/network';
import { IPathService } from 'vs/workbench/services/path/common/pathService';
import { IConfigurationRegistry, Extensions, ConfigurationScope } from 'vs/platform/configuration/common/configurationRegistry';
import { Registry } from 'vs/platform/registry/common/platform';
import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { IExternalTerminalMainService } from 'vs/platform/externalTerminal/electron-sandbox/externalTerminalMainService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { TerminalContextKeys } from 'vs/workbench/contrib/terminal/common/terminalContextKey';

const OPEN_NATIVE_CONSOLE_COMMAND_ID = 'workbench.action.terminal.openNativeConsole';
KeybindingsRegistry.registerCommandAndKeybindingRule({
	id: OPEN_NATIVE_CONSOLE_COMMAND_ID,
	primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KEY_C,
	when: TerminalContextKeys.notFocus,
	weight: KeybindingWeight.WorkbenchContrib,
	handler: async (accessor) => {
		const historyService = accessor.get(IHistoryService);
		// Open external terminal in local workspaces
		const terminalService = accessor.get(IExternalTerminalService);
		const configurationService = accessor.get(IConfigurationService);
		const root = historyService.getLastActiveWorkspaceRoot(Schemas.file);
		const config = configurationService.getValue<IExternalTerminalSettings>('terminal.external');
		if (root) {
			terminalService.openTerminal(config, root.fsPath);
		} else {
			// Opens current file's folder, if no folder is open in editor
			const activeFile = historyService.getLastActiveFile(Schemas.file);
			if (activeFile) {
				terminalService.openTerminal(config, paths.dirname(activeFile.fsPath));
			} else {
				const pathService = accessor.get(IPathService);
				const userHome = await pathService.userHome();
				terminalService.openTerminal(config, userHome.fsPath);
			}
		}
	}
});

MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
	command: {
		id: OPEN_NATIVE_CONSOLE_COMMAND_ID,
		title: { value: nls.localize('globalConsoleAction', "Open New External Terminal"), original: 'Open New External Terminal' }
	}
});

export class ExternalTerminalContribution implements IWorkbenchContribution {

	public _serviceBrand: undefined;
	constructor(@IExternalTerminalMainService private readonly _externalTerminalService: IExternalTerminalMainService) {
		this._updateConfiguration();
	}

	private async _updateConfiguration(): Promise<void> {
		const terminals = await this._externalTerminalService.getDefaultTerminalForPlatforms();
		let configurationRegistry = Registry.as<IConfigurationRegistry>(Extensions.Configuration);
		configurationRegistry.registerConfiguration({
			id: 'externalTerminal',
			order: 100,
			title: nls.localize('terminalConfigurationTitle', "External Terminal"),
			type: 'object',
			properties: {
				'terminal.explorerKind': {
					type: 'string',
					enum: [
						'integrated',
						'external'
					],
					enumDescriptions: [
						nls.localize('terminal.explorerKind.integrated', "Use VS Code's integrated terminal."),
						nls.localize('terminal.explorerKind.external', "Use the configured external terminal.")
					],
					description: nls.localize('explorer.openInTerminalKind', "Customizes what kind of terminal to launch."),
					default: 'integrated'
				},
				'terminal.external.windowsExec': {
					type: 'string',
					description: nls.localize('terminal.external.windowsExec', "Customizes which terminal to run on Windows."),
					default: terminals.windows,
					scope: ConfigurationScope.APPLICATION
				},
				'terminal.external.osxExec': {
					type: 'string',
					description: nls.localize('terminal.external.osxExec', "Customizes which terminal application to run on macOS."),
					default: DEFAULT_TERMINAL_OSX,
					scope: ConfigurationScope.APPLICATION
				},
				'terminal.external.linuxExec': {
					type: 'string',
					description: nls.localize('terminal.external.linuxExec', "Customizes which terminal to run on Linux."),
					default: terminals.linux,
					scope: ConfigurationScope.APPLICATION
				}
			}
		});
	}
}
