package io.github.simon123h.jotter_lite;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    /** Shared text beyond this is cut: it travels in a link, and a task is not the place for a whole article. */
    private static final int MAX_SHARED_CHARS = 20000;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(StoragePermissionPlugin.class);
        setIntent(asLink(getIntent()));
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(asLink(intent));
    }

    /**
     * Text another app shares with Jotter becomes a jotter://share link, which the web side handles the way it handles
     * the launcher shortcuts (src/shortcuts.ts), whether the app was running or not.
     */
    private static Intent asLink(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return intent;
        String type = intent.getType();
        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (type == null || !type.startsWith("text/") || text == null) return intent;

        Uri.Builder link = new Uri.Builder().scheme("jotter").authority("share").appendQueryParameter("text", cut(text));
        String subject = intent.getStringExtra(Intent.EXTRA_SUBJECT);
        if (subject != null) link.appendQueryParameter("title", cut(subject));
        intent.setAction(Intent.ACTION_VIEW);
        intent.setData(link.build());
        return intent;
    }

    private static String cut(String text) {
        return text.length() > MAX_SHARED_CHARS ? text.substring(0, MAX_SHARED_CHARS) : text;
    }
}
