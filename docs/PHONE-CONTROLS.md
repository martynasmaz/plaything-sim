# Phone controls

The default clearing interface adapts to a small screen whose primary pointer
is coarse (touch). Portrait widths through 900 CSS pixels and landscape screens
through 1100 by 550 CSS pixels receive the phone controls. A narrow desktop
window with a mouse keeps its desktop controls. Large tablets and the other
UI presets retain their existing interface. Rotating or resizing the device
updates the controls without replacing the world or save.

The phone toolbar contains Powers, Observe, Time and Speak. Powers opens a
scrollable tray; selecting an effect shows its description, availability and
a Cast button. Destructive effects have an additional confirmation. Choosing
a power does not focus an input or open the keyboard. All casts submit to the
existing command form, which retains its parser, checks, effects and saving.
The `magic` unlock is absent from the power tray; it must still be typed in
Speak. Speak also accepts custom quantities and the existing text commands.

After a successful tray cast, a large “↻ Cast [power]” button stays above the
phone toolbar. Each tap repeats that same power through the shared command
handler, without reopening a menu or the keyboard. A destructive power keeps
its initial confirmation; subsequent deliberate taps repeat the chosen effect.
The button updates when another power succeeds and disables whenever that
power is unavailable. It is hidden during menus, on desktop and until a power
has been used. Selection lasts for the current page session. Next day, day
skips, rewinds and undo skip can also become the repeat action. Repeated time
changes wait for the current operation to complete; rewinds stop at day zero
and still require recorded history. Failed operations keep the previous action.
Speak and the manually typed magic unlock do not become repeat buttons.
Inspection cards move above the button so that neither covers the other.

The phone day/phase display uses a compact, content-sized dark backing, bright outlined type,
and larger text sized in screen pixels so portrait displays do not shrink it
with the world map. Paused time is stated explicitly. The clock fits beside the
phone's pause and home buttons.

Observe opens the same notebook in a phone-sized modal sheet. Time provides
pause, 1× and 3× speed, day stepping, rewind, undo skip and camera recentering.
Pause and return-to-village buttons also remain reachable above the map.
Menu reading pauses playback by default. This is a presentation clock hold,
not a new speed or a simulation rule: closing the sheet continues at the
selected speed, with no elapsed-time catch-up. Turning off “Pause while menus
are open” is remembered separately from the village save. An explicit pause
remains paused after a menu closes.

Only Speak focuses a text field. The sheets use the visual viewport to remain
above the on-screen keyboard. Controls account for safe-area insets, use large
tap targets and preserve the parchment/woodland appearance.

Touch selection happens on release, tolerates eight pixels of finger jitter,
and uses enlarged invisible hit areas. Dragging, pinching or canceling a touch
does not inspect anything. Villager, hut and cache details appear in a
dismissible lower card. Drag and pinch still move the camera. A phone starts
closer to the founding camp, and Return to village restores that view.

On desktop, the command box, keyboard, camera and hover interaction remain.
Two requested inspection cleanups apply to both devices: the herb shelter
card keeps its title and “Home of [name]” without builder/priority commentary;
the uphill cache uses an inspection card instead of text on the zoomed map.

`tests/phone-ui.test.js` exercises the controller against the real command
simulation, including desktop isolation, confirmation, manual magic unlock,
clock holding, keyboard viewport changes and gesture cancellation.
`scripts/phone-render-smoke.mjs` uses native Canvas and the actual map pointer
handlers to check touch selection, house cards, camera recentering, cache
hover at multiple desktop zoom levels and unchanged simulation state.
These checks do not replace testing keyboard and sheet layout on a real phone.
