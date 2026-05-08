// Centralized queue name registry. Job producers @InjectQueue with these names;
// consumers (BullMQ Processors) declare @Processor with the same names.
//
// Both queues share the Valkey connection configured in QueueModule.

export enum QueueName {
  ANOMALY_DETECT = 'anomaly-detect',
  PUSH_DISPATCH = 'push-dispatch',
}
