# Controller input

Open **Settings → Controller** in the top bar. Connect a gamepad and press a button if it has not appeared yet. Choose the first available controller or a particular device. Enable/disable input, adjust the stick deadzone and pointer/camera speeds, and edit bindings here. Preferences save immediately on this computer and survive app restarts.

Choose **Bind** beside an action, release the current control, then press a button or move a stick. Buttons, analog triggers and either direction of a stick axis can be assigned. One input has one action: assigning it elsewhere clears its previous binding. Opposite axis directions are separate inputs. **Clear** removes a mapping; **Restore defaults** restores the initial layout. Click the listening row's **Cancel** button, use Cancel binding, or press Escape to abandon a capture. Capture also times out after 20 seconds.

## Starting layout

| Control on a standard gamepad | Action |
| --- | --- |
| Left stick | Move the virtual pointer |
| Right stick | Pan the table |
| A / Cross | Activate the pointed/focused card or control |
| B / Circle | Cancel placement or close a menu/dialog |
| X / Square | Activate a battlefield source, or tap/correctively untap |
| Hold Y / Triangle | Inspect the card under the pointer |
| LB / L1 and RB / R1 | Previous/next card in the pinned hand |
| LT / L2 and RT / R2 | Zoom out/in |
| Left stick press | Pick up/place a card |
| Right stick press | Fit your playmat |
| D-pad up/down | Previous/next interface control |
| D-pad left/right | Decrease/increase a number or select another option |
| View / Share | Open/close controller settings |
| Menu / Options | Next step |

Button numbers are also displayed in settings. Labels describe the standard layout; nonstandard devices may report different numbers and should be remapped. Additional actions are available to bind, including **Draw**, **Pass priority**, **End turn**, **Undo**, seat navigation, card actions, face-down/up, manual tapping, whole-table view and the stack panel. They start unassigned.

## Playing

Point at a card or use the hand-navigation buttons. Activate a playable hand card to use the normal land-play or casting interface. Select mana choices, payment controls, targets and confirmation buttons with the pointer or D-pad. D-pad left/right changes focused numeric fields, sliders and selects; activate checkboxes to toggle them. Text entry still uses the keyboard.

To move a card, point at it and press **Pick up/place**. The pointer changes to a card shape. Move to the destination zone and press again; **Cancel** abandons placement. The existing drop handler still applies casting costs, zones, control permissions and multiplayer packets. This first version uses a centered grab point. Opponents' concealed hands cannot be picked up.

Gameplay shortcuts do not run behind open dialogs or while editing a field. Required resolution choices cannot be dismissed with Cancel. Holding a gameplay button does not draw repeatedly, advance several steps or end several turns. Navigation and zoom can repeat. Connecting, refocusing, enabling input or finishing a rebind requires releasing controls before gameplay resumes. Disconnecting or losing focus releases inspection and cancels a carried card.

Mouse and keyboard controls remain available. Moving the physical pointer hides the virtual-pointer indicator. Controller settings and camera movement are local; gameplay continues through the same dispatcher and host authorization as other controls.

## Implementation and checks

`controller.mjs` contains the action catalog, defaults, settings validation, binding assignment/capture and input-state interpretation. `controller-ui.mjs` handles polling, settings, the virtual pointer and interface navigation. The small application adapter invokes existing controls and the existing card-drop path. This uses fresh Gamepad API samples in an animation loop, as described in [MDN's Gamepad API documentation](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API).

Unit tests exercise binding conflicts, persisted settings, drift, repeats, edge-triggered gameplay, focus/reconnect handling and capture. `npm.cmd run test:ui:controller` uses simulated gamepad data in an isolated offscreen Electron window to verify settings, persistence, pointer movement, value controls, mana, inspection, card placement, camera and hand navigation. It is included in the full desktop suite. Physical USB/Bluetooth controller detection has not been tested in this environment; device-specific tuning remains for hands-on playtesting. Vibration, controller-only text entry and separate mapping profiles for each device are not included yet.
