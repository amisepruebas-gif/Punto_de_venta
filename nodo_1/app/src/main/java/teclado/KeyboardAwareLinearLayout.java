package teclado;

import android.content.Context;
import android.graphics.Rect;
import android.util.AttributeSet;
import android.widget.LinearLayout;

public class KeyboardAwareLinearLayout extends LinearLayout {

    private KeyboardVisibilityListener listener;

    public KeyboardAwareLinearLayout(Context context) {
        super(context);
    }

    public KeyboardAwareLinearLayout(Context context, AttributeSet attrs) {
        super(context, attrs);
    }

    public KeyboardAwareLinearLayout(Context context, AttributeSet attrs, int defStyleAttr) {
        super(context, attrs, defStyleAttr);
    }

    @Override
    protected void onLayout(boolean changed, int left, int top, int right, int bottom) {
        super.onLayout(changed, left, top, right, bottom);

        if (listener != null) {
            Rect rect = new Rect();
            getWindowVisibleDisplayFrame(rect);
            int screenHeight = getRootView().getHeight();
            int keypadHeight = screenHeight - rect.bottom;

            // Si el tamaño del teclado es más del 15% de la altura de la pantalla, el teclado está visible
            boolean isKeyboardVisible = keypadHeight > screenHeight * 0.15;

            listener.onVisibilityChanged(isKeyboardVisible);
        }
    }

    public void setKeyboardVisibilityListener(KeyboardVisibilityListener listener) {
        this.listener = listener;
    }

    public interface KeyboardVisibilityListener {
        void onVisibilityChanged(boolean isVisible);
    }
}
