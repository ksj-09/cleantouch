package kr.cleantouch.scan;

import android.app.Activity;
import android.os.Bundle;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.widget.ImageView;
import java.io.InputStream;

/** Independent fixture app: no Kotlin/app dependency needed in its separate process. */
public class VideoFixtureActivity extends Activity {
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        ImageView image = new ImageView(this);
        try (InputStream input = getAssets().open("bag.png")) {
            image.setImageBitmap(BitmapFactory.decodeStream(input));
        } catch (java.io.IOException error) { throw new IllegalStateException(error); }
        image.setScaleType(ImageView.ScaleType.FIT_CENTER);
        image.setBackgroundColor(Color.BLACK);
        setContentView(image);
        // A video fixture must keep producing Surface frames even when its product stays still.
        image.post(new Runnable() {
            private boolean dim = false;
            @Override public void run() {
                dim = !dim;
                image.setAlpha(dim ? 0.99f : 1.0f);
                image.postDelayed(this, 250);
            }
        });
    }
}
