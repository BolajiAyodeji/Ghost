import logging from '@tryghost/logging';

export interface Actor {
    id: string;
    type: 'user' | 'integration';
}

export interface RequestContext {
    actor: Actor | null;
}

export interface ActionRecorder {
    add(data: Record<string, unknown>, options: {autoRefresh: boolean}): Promise<unknown>;
}

// Field-definition changes map to activity-feed events. A field's timeline reads
// added -> edited -> archived -> restored, and a permanent delete (only from the
// archived state) ends it with deleted.
const COMMANDS = {
    create: 'added',
    rename: 'edited',
    archive: 'archived',
    restore: 'restored',
    delete: 'deleted'
} as const satisfies Record<string, 'added' | 'edited' | 'archived' | 'restored' | 'deleted'>;

export type CustomFieldVerb = keyof typeof COMMANDS;

export type RecordCustomFieldAction =
    (input: {context: RequestContext; verb: CustomFieldVerb; subject: string}) => Promise<void>;

// Best-effort action-log write: a failed action must never fail the command that triggered it.
export async function recordCustomFieldAction(
    {Action, context, verb, subject}:
    {Action: ActionRecorder; context: RequestContext; verb: CustomFieldVerb; subject: string}
): Promise<void> {
    if (!context.actor) {
        return;
    }
    try {
        await Action.add({
            event: COMMANDS[verb],
            resource_type: 'member_custom_field',
            resource_id: subject,
            actor_type: context.actor.type,
            actor_id: context.actor.id
        }, {autoRefresh: false});
    } catch (err) {
        logging.error(err);
    }
}
