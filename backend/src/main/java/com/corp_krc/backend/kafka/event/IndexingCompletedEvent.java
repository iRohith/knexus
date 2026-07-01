package com.corp_krc.backend.kafka.event;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.util.UUID;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
public class IndexingCompletedEvent extends BaseEvent {

    private UUID documentId;
    private UUID jobId;
    private String cogneeDatasetId;
}
