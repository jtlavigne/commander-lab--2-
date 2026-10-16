# Corrections and qualifications for the supplied keyword guide

The [linked guide](https://docs.google.com/document/d/1VDbfPI59vyM8S704KoHreT3vOI_2KiHnVp6UM9ay-_s/edit) is useful as a list of mechanics to test. Its simplified explanations must not become implementation specifications without checking the [current Comprehensive Rules](https://media.wizards.com/2026/downloads/MagicCompRules%2020260925.txt) and the card's Oracle text. This is an initial correction list, not a completed review of every claim. Historical rarity, popularity and strength opinions do not define engine behavior.

| Guide topic | Required correction / qualification |
| --- | --- |
| Deathtouch | Positive damage can lead to destruction at a state-based-action check; prevention and indestructible still matter. It is not an unconditional kill or inherently a triggered ability. |
| Defender / Walls | Use current Oracle text. Wall is a creature type, not an intrinsic attack restriction. |
| Enchant | An Aura cast as a spell targets. An Aura entering without being cast can require a legal attachment choice as it enters, without targeting. It does not enter first and then choose a target. |
| Equip | Equipment can become unattached through rules or other effects. Equip itself normally attaches to a creature you control at sorcery timing. |
| Protection | Qualities can include more than colors. Separately test damage prevention, blocking, targeting and attachment restrictions. |
| Ward | The triggered ability can counter the offending spell **or ability**; it is not a targeting prohibition. Different printed costs require their own payment choices. |
| Reconfigure | This is a keyword ability (702), with both attachment and unattachment and an attached-creature exception. |
| Regeneration | A shield replaces a later destruction; it also removes marked damage and removes the permanent from combat. It does not save a sacrifice or zero-toughness creature. |
| Sacrifice | A permanent's controller sacrifices it into its owner's graveyard, subject to replacements; ownership and control are distinct. |
| Adapt | Check for existing +1/+1 counters when the action resolves. Paying an activation cost does not immediately add counters. |
| Adventure | Casting the normal spell first is legal. Adventure's later casting permission follows successful adventure resolution and the specified exile. |
| Aftermath | The aftermath half is restricted to the graveyard; do not invent a universal hand-only restriction for every other half. |
| Amplify | This modifies battlefield entry and uses shared creature types, not just broad card types or a cast trigger. |
| Bolster | Choose, without targeting, a controlled creature tied for least current toughness. Bolster itself is not an attack trigger. |
| Casualty | The sacrificed creature needs power **at least** the casualty value; copying is triggered by payment of the additional cost. |
| Champion / Exploit | These involve triggered abilities associated with entry, rather than universal casting costs. Preserve response windows and optional/required follow-up semantics. |
| Daybound / Nightbound | Day/night changes at the appropriate turn boundary, using the previous active player's spell count; it is not an immediate switch on a second cast. |
| Evoke | Sacrificing is an enters-triggered ability, with a response window, not an immediate uninterruptible sacrifice. |
| Explore | The action can be instructed by multiple types of effect. Test an empty library and a source that left, as well as land/nonland outcomes and the graveyard choice. |
| Flanking | A blocker with flanking does not cause the ordinary flanking trigger; do not apply the penalty to every blocker indiscriminately. |
| Hideaway | Use its printed number, not a hardcoded four. Playing the exiled card is a separate linked ability. |
| Indestructible | Marked damage plus a toughness reduction does not bypass indestructible unless toughness reaches zero or less or another applicable rule removes the permanent. Damage/reduction order alone does not reverse this result. |
| Manifest | The mana-cost special action requires a creature card with a mana cost. Other face-up permissions such as morph are separate. |
| Monstrosity | An ability can be activated again, but its action does nothing if already monstrous. Removing counters does not remove the designation. |
| Morph | Face-down casting uses the stack. The paid face-up special action does not; triggered abilities from turning face up do. |
| Phasing | Ordinary phasing happens during untap, before untapping, not during upkeep. Phasing is not a zone change. |
| Poisonous / Infect / Wither | Poisonous triggers on combat damage to a player. Infect and wither modify damage results, including lethal damage; they do not mean the source never deals damage. |
| Proliferate | Choose any number of eligible players/permanents; each chosen recipient gets one additional counter of **each** kind it already has. |
| Rampage | Count blocking creatures beyond the first, rather than every blocker. |
| Rebound | The alternative exile destination applies when the qualifying spell resolves after being cast from hand. Countering it does not grant rebound. |
| Renown | The parameter is Renown N, not Reinforce N. Use the not-yet-renowned condition and its triggered ability. |
| Riot | Choose a +1/+1 counter **or** haste, not both. |
| Spectacle | It checks whether an opponent lost life, which need not be damage. |
| Split second | It restricts casting and nonmana activation. Mana abilities, triggered abilities and applicable special actions still work. |
| Storm | Distinguish the original spell from the additional copies. Copies are not ordinarily cast. |
| Support | Choose up to N targets; on a permanent it excludes that permanent. It does not require choosing your own creatures. |
| Umbra armor | Replaces destruction, not every death. Sacrifice and zero toughness do not use it. |
| Unearth | Includes a leave-the-battlefield replacement as well as the delayed exile instruction; returning the card to hand does not simply evade it. |
| Ferocious | The relevant threshold is power four **or greater**, not strictly greater than four. The rest of the printed ability determines timing and effect. |
| Heroic | Read the printed trigger: common heroic wording requires a spell **you cast**, not just any spell that targets the creature. |
| Landfall and other ability words | Compile the printed condition and effect. The label supplies no independent rules behavior. |

Use [the implementation audit](keyword-audit.md) for coverage status. A correction here is not evidence that the corresponding engine behavior has already been implemented or tested.
