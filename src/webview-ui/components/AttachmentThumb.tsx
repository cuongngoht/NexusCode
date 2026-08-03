import React, { useState } from 'react';
import { IconDoc } from '../NexusIcons';
import { useT, interp } from '../i18n';
import { toWorkspaceResourceUri } from '../resourceUri';

interface Props {
  /** Workspace-relative path of the image. */
  path: string;
  size?: number;
}

/**
 * Thumbnail for an image attachment, loaded lazily from disk so it survives panel reloads
 * and history rehydration. Falls back to a document icon when the file is gone (e.g. the user
 * cleaned `.nexus/`) or when no resource base was stamped onto the document.
 */
export function AttachmentThumb({ path, size = 40 }: Props) {
  const t = useT();
  const [failed, setFailed] = useState(false);
  const src = toWorkspaceResourceUri(path);

  if (!src || failed) {
    return (
      <span className="fl-att-thumb-missing" title={failed ? t.composer.imageMissing : path}>
        <IconDoc size={13} />
      </span>
    );
  }

  return (
    <img
      className="fl-att-thumb"
      src={src}
      width={size}
      height={size}
      alt={interp(t.composer.imageThumbnailAlt, { name: path })}
      title={path}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
